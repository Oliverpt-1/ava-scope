// import dotenv from 'dotenv'; // dotenv is no longer directly used here
// import path from 'path'; // path is no longer directly used here
import { 
  getAllSubnetsForPolling, 
  addDirectMetricsSamples,
  getLastProcessedBlockForSubnet,
  addGasUtilizationSample,
  insertErcTransferCountsBatch,
  ErcTransferBlockData
} from '../lib/supabaseHelpers';
import { 
  getMetrics, 
  fetchAndProcessBlockRangeForTransfersAndGas,
  fetchEthBlockByNumber,
  getRawLogsForBlockRange
} from '../services/metrics';
import axios from 'axios'; // For fetching current block number

// // DEBUGGING: Log the key after dotenv.config() // REMOVE THIS
// console.log(`[DEBUG Poller] SUPABASE_SERVICE_ROLE_KEY after dotenv: '${process.env.SUPABASE_SERVICE_ROLE_KEY}'`); // REMOVE THIS

const POLLING_INTERVAL_MS = 15 * 1000; // Changed to 2 seconds
const INITIAL_HISTORICAL_BLOCK_COUNT = 2000; // How many blocks to fetch on the very first run for a subnet
const MAX_BLOCKS_TO_PROCESS_PER_CYCLE = 500; // Reduced for more frequent, smaller transfer batches
const ERC_LOG_BATCH_SIZE = 100; // How many blocks to query for logs at a time for transfers
const ERC_INSERT_BATCH_SIZE = 50; // How many records to batch insert for transfers

const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a123bf2ecdcdffac2282';

let isPolling = false; // Simple lock to prevent concurrent polling runs if one takes too long

async function getCurrentChainHeadBlock(rpcUrl: string): Promise<number | null> {
  try {
    const response = await axios.post(rpcUrl, 
      { jsonrpc: '2.0', id: 'eth_blockNumber_poller', method: 'eth_blockNumber', params: [] }, 
      { headers: { 'Content-Type': 'application/json' }, timeout: 7000 }
    );
    if (response.data && response.data.result) {
      return parseInt(response.data.result, 16);
    }
    console.error(`[Poller] Invalid response for eth_blockNumber from ${rpcUrl}:`, response.data);
    return null;
  } catch (error) {
    console.error(`[Poller] Error fetching eth_blockNumber from ${rpcUrl}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function pollSubnetMetrics() {
  if (isPolling) {
    console.log('[Poller] Polling is already in progress. Skipping this cycle.');
    return;
  }
  isPolling = true;
  console.log(`[Poller - ${new Date().toISOString()}] Starting metrics polling cycle...`);

  try {
    const subnetsToPoll = await getAllSubnetsForPolling();
    if (!subnetsToPoll || subnetsToPoll.length === 0) {
      console.log('[Poller] No subnets configured for polling. Sleeping for this cycle.');
      isPolling = false;
      return;
    }
    console.log(`[Poller] Found ${subnetsToPoll.length} subnets to poll.`);

    for (const subnet of subnetsToPoll) {
      console.log(`[Poller] Processing subnet: ${subnet.name} (ID: ${subnet.id})`);
      try {
        // 1. Fetch live metrics (TPS, current block time)
        const liveMetrics = await getMetrics(subnet.rpc_url);
        if (liveMetrics) {
          // Store direct metrics like TPS and blocktime
          await addDirectMetricsSamples(subnet.id, liveMetrics);
          console.log(`[Poller - ${subnet.name}] Successfully stored direct live metrics (TPS, blocktime).`);

          // Store gas utilization for the LATEST block obtained from getMetrics
          const bp = liveMetrics.blockProduction;
          console.log(`[Poller - ${subnet.name}] Latest block production data from getMetrics:`, JSON.stringify(bp));
          if (
            bp.latestBlock !== null && 
            bp.gasUsed !== null && 
            bp.gasLimit !== null && 
            bp.latestBlockTimestamp !== null
          ) {
            let utilization = 0;
            if (bp.gasLimit > 0) {
              utilization = parseFloat(((bp.gasUsed / bp.gasLimit) * 100).toFixed(1));
              console.log(`[Poller - ${subnet.name}] Calculated utilization for latest block #${bp.latestBlock}: ${utilization}%`);
            } else if (bp.gasLimit === 0 && bp.gasUsed === 0) {
              console.log(`[Poller - ${subnet.name}] Latest block #${bp.latestBlock} is an empty block (gasUsed and gasLimit are 0). Setting utilization to 0.`);
              utilization = 0;
            } else {
              console.warn(`[Poller - ${subnet.name}] Latest block #${bp.latestBlock} has gasLimit <= 0 but gasUsed is not 0. GasLimit: ${bp.gasLimit}, GasUsed: ${bp.gasUsed}. Skipping gas utilization storage for this block.`);
              // Skip calling addGasUtilizationSample if gasLimit is not valid for calculation but block wasn\'t strictly empty
              continue; // Move to the next part of the loop (historical/batch processing)
            }
            
            console.log(`[Poller - ${subnet.name}] Calling addGasUtilizationSample for latest block #${bp.latestBlock}`);
            await addGasUtilizationSample(
              subnet.id,
              bp.latestBlock,
              new Date(bp.latestBlockTimestamp * 1000).toISOString(),
              bp.gasUsed,
              bp.gasLimit,
              utilization
            );
          } else {
            console.warn(`[Poller - ${subnet.name}] Insufficient data in liveMetrics.blockProduction to store latest gas utilization. Data:`, JSON.stringify(bp));
          }
        } else {
          console.warn(`[Poller - ${subnet.name}] Could not retrieve live metrics. Might be an RPC issue.`);
        }

        // 2. Process historical/new blocks for Gas Utilization AND NOW ERC Transfers
        const currentChainHead = await getCurrentChainHeadBlock(subnet.rpc_url);
        if (currentChainHead === null) {
          console.error(`[Poller - ${subnet.name}] Failed to get current chain head block. Skipping extended metrics for this cycle.`);
          continue; 
        }

        let lastProcessedGasBlock = await getLastProcessedBlockForSubnet(subnet.id);
        let fromBlockForGas = lastProcessedGasBlock === null 
            ? Math.max(0, currentChainHead - INITIAL_HISTORICAL_BLOCK_COUNT + 1)
            : lastProcessedGasBlock + 1;

        if (fromBlockForGas > currentChainHead) {
          console.log(`[Poller - ${subnet.name}] No new blocks to process for extended metrics. (From: ${fromBlockForGas}, Head: ${currentChainHead}).`);
        } else {
          // Cap the number of blocks to process in one go to prevent very long cycles
          const toBlockForGas = Math.min(currentChainHead, fromBlockForGas + MAX_BLOCKS_TO_PROCESS_PER_CYCLE - 1);
          
          console.log(`[Poller - ${subnet.name}] Processing Gas/ERC for blocks ${fromBlockForGas} to ${toBlockForGas}. Head: ${currentChainHead}`);
          
          // A. Process Gas Utilization (using the existing complex function for now, though it also does ERC - this might be refactored later)
          // For now, let fetchAndProcessBlockRangeForTransfersAndGas handle its gas part for this range.
          // This function ALREADY saves gas_utilization_samples.
          // We will add separate ERC log fetching for the same range below.
          
          // B. Fetch, Process, and Store ERC Transfers for this same block range
          let ercTransfersToInsert: ErcTransferBlockData[] = [];
          const blockTimestampsCache = new Map<number, string | null>(); // Cache timestamps within this cycle

          for (let batchStartBlock = fromBlockForGas; batchStartBlock <= toBlockForGas; batchStartBlock += ERC_LOG_BATCH_SIZE) {
            const batchEndBlock = Math.min(batchStartBlock + ERC_LOG_BATCH_SIZE - 1, toBlockForGas);
            // console.log(`[Poller - ${subnet.name}] Fetching ERC logs for sub-batch ${batchStartBlock}-${batchEndBlock}`);
            
            const rawLogs = await getRawLogsForBlockRange(subnet.rpc_url, batchStartBlock, batchEndBlock, TRANSFER_EVENT_TOPIC);
            if (rawLogs.length === 0) continue;

            const transfersInBatchByBlock = new Map<number, number>();
            for (const log of rawLogs) {
                if (log.topics && log.topics[0] && log.topics[0].toLowerCase() === TRANSFER_EVENT_TOPIC.toLowerCase() && log.topics.length >=3) {
                    const blockNum = parseInt(log.blockNumber, 16);
                    transfersInBatchByBlock.set(blockNum, (transfersInBatchByBlock.get(blockNum) || 0) + 1);
                }
            }

            for (const [blockNum, count] of transfersInBatchByBlock) {
              let isoTimestamp = blockTimestampsCache.get(blockNum);
              if (isoTimestamp === undefined) { // Check undefined, as null means fetch failed previously
                const blockDetails = await fetchEthBlockByNumber(subnet.rpc_url, `0x${blockNum.toString(16)}`, false);
                if (blockDetails && blockDetails.timestamp) {
                  isoTimestamp = new Date(blockDetails.timestamp * 1000).toISOString();
                } else {
                  console.warn(`[Poller - ${subnet.name}] Failed to get timestamp for block #${blockNum} for ERC transfers. Skipping.`);
                  isoTimestamp = null; // Mark as failed to prevent re-fetch in this cycle
                }
                blockTimestampsCache.set(blockNum, isoTimestamp);
              }

              if (isoTimestamp) {
                ercTransfersToInsert.push({
                  subnet_id: subnet.id,
                  block_number: blockNum,
                  block_timestamp: isoTimestamp,
                  erc20_transfers: count, // All transfers are ERC20 for now
                  erc721_transfers: 0,
                });
              }
              if (ercTransfersToInsert.length >= ERC_INSERT_BATCH_SIZE) {
                await insertErcTransferCountsBatch(ercTransfersToInsert);
                ercTransfersToInsert = [];
              }
            }
          }
          if (ercTransfersToInsert.length > 0) {
            await insertErcTransferCountsBatch(ercTransfersToInsert);
          }
          console.log(`[Poller - ${subnet.name}] ERC transfer processing finished for blocks ${fromBlockForGas}-${toBlockForGas}.`);
           // The existing fetchAndProcessBlockRangeForTransfersAndGas is still called for its Gas part below
           // This means gas_utilization_samples is populated by that function for this range.
        }

        // Call the original combined function - primarily for its GAS processing part now.
        // Its ERC processing part is now somewhat redundant but harmless if inserts are ignore-duplicates.
        // TODO: Refactor fetchAndProcessBlockRangeForTransfersAndGas to only do gas, or make a separate gas-only function.
        if (fromBlockForGas <= currentChainHead) {
            const toBlockForProcessing = Math.min(currentChainHead, fromBlockForGas + MAX_BLOCKS_TO_PROCESS_PER_CYCLE - 1);
            // console.log(`[Poller - ${subnet.name}] Calling original processor for Gas for blocks ${fromBlockForGas} to ${toBlockForProcessing}.`);
            await fetchAndProcessBlockRangeForTransfersAndGas(
                subnet.rpc_url,
                subnet.id,
                fromBlockForGas,
                toBlockForProcessing
            );
        }

      } catch (error) {
        console.error(`[Poller - ${subnet.name}] Error processing subnet ${subnet.name} (ID: ${subnet.id}):`, error instanceof Error ? error.message : error);
      }
    }
  } catch (error) {
    console.error('[Poller] Critical error during polling cycle:', error instanceof Error ? error.message : error);
  } finally {
    isPolling = false;
    console.log(`[Poller - ${new Date().toISOString()}] Metrics polling cycle finished.`);
  }
}

function startPolling() {
  console.log(`AvaScope Polling Worker started. Polling interval: ${POLLING_INTERVAL_MS / 1000} seconds.`);
  
  // Initial poll immediately
  pollSubnetMetrics().catch(err => console.error('Unhandled error during initial poll:', err));

  // Then set interval for subsequent polls
  setInterval(() => {
    pollSubnetMetrics().catch(err => console.error('Unhandled error during scheduled poll:', err));
  }, POLLING_INTERVAL_MS);

  // Keep the worker alive (e.g., if running as a standalone script)
  // This might not be necessary if deployed as a background worker on a platform like Render.
  // For local testing with ts-node, it helps.
  process.stdin.resume(); 
  console.log('Polling worker is running. Press Ctrl+C to stop.');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down polling worker gracefully...');
  // Perform any cleanup if necessary
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down polling worker gracefully...');
  // Perform any cleanup if necessary
  process.exit(0);
});

// Start the poller
startPolling(); 