// import dotenv from 'dotenv'; // dotenv is no longer directly used here
// import path from 'path'; // path is no longer directly used here
import { 
  getAllSubnetsForPolling, 
  addDirectMetricsSamples,
  getLastProcessedBlockForSubnet,
  addGasUtilizationSample
} from '../lib/supabaseHelpers';
import { 
  getMetrics, 
  fetchAndProcessBlockRangeForTransfersAndGas
} from '../services/metrics';
import axios from 'axios'; // For fetching current block number

// // DEBUGGING: Log the key after dotenv.config() // REMOVE THIS
// console.log(`[DEBUG Poller] SUPABASE_SERVICE_ROLE_KEY after dotenv: '${process.env.SUPABASE_SERVICE_ROLE_KEY}'`); // REMOVE THIS

const POLLING_INTERVAL_MS = 2 * 1000; // Changed to 2 seconds
const INITIAL_HISTORICAL_BLOCK_COUNT = 2000; // How many blocks to fetch on the very first run for a subnet
const MAX_BLOCKS_TO_PROCESS_PER_CYCLE = 5000; // Safety cap: Max blocks to process in one poller cycle for historical catch-up

let isPolling = false; // Simple lock to prevent concurrent polling runs if one takes too long

async function getCurrentChainHeadBlock(rpcUrl: string): Promise<number | null> {
  try {
    const response = await axios.post(rpcUrl, 
      { jsonrpc: '2.0', id: 'chainIdCheck', method: 'eth_blockNumber', params: [] }, 
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

        // 2. Process historical/new blocks for Gas Utilization and ERC Transfers
        const currentChainHead = await getCurrentChainHeadBlock(subnet.rpc_url);
        if (currentChainHead === null) {
          console.error(`[Poller - ${subnet.name}] Failed to get current chain head block. Skipping extended metrics for this cycle.`);
          continue; 
        }

        let lastProcessedBlock = await getLastProcessedBlockForSubnet(subnet.id);
        let fromBlockToProcess: number;
        
        if (lastProcessedBlock === null) {
          // First time processing this subnet, or no gas samples yet
          fromBlockToProcess = Math.max(0, currentChainHead - INITIAL_HISTORICAL_BLOCK_COUNT + 1); 
          console.log(`[Poller - ${subnet.name}] First run or no prior gas_utilization_samples. Starting extended metrics from block ${fromBlockToProcess} (current head: ${currentChainHead}).`);
        } else {
          fromBlockToProcess = lastProcessedBlock + 1;
          console.log(`[Poller - ${subnet.name}] Resuming extended metrics from block ${fromBlockToProcess} (last processed: ${lastProcessedBlock}, current head: ${currentChainHead}).`);
        }

        if (fromBlockToProcess > currentChainHead) {
          console.log(`[Poller - ${subnet.name}] No new blocks to process for extended metrics. (From: ${fromBlockToProcess}, Head: ${currentChainHead}).`);
        } else {
          // Cap the number of blocks to process in one go to prevent very long cycles
          const toBlockToProcess = Math.min(currentChainHead, fromBlockToProcess + MAX_BLOCKS_TO_PROCESS_PER_CYCLE - 1);
          
          console.log(`[Poller - ${subnet.name}] Fetching and processing extended metrics for blocks ${fromBlockToProcess} to ${toBlockToProcess}.`);
          const { lastSuccessfullyProcessedBlock: actualLastProcessed } = await fetchAndProcessBlockRangeForTransfersAndGas(
            subnet.rpc_url,
            subnet.id,
            fromBlockToProcess,
            toBlockToProcess
          );

          if (actualLastProcessed !== null) {
            console.log(`[Poller - ${subnet.name}] Successfully processed extended metrics up to block ${actualLastProcessed}.`);
             if (toBlockToProcess < currentChainHead) {
              console.log(`[Poller - ${subnet.name}] More blocks remain (${actualLastProcessed + 1} to ${currentChainHead}). Will continue in next cycle.`);
            }
          } else {
            console.warn(`[Poller - ${subnet.name}] Processing extended metrics for range ${fromBlockToProcess}-${toBlockToProcess} did not complete fully.`);
          }
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