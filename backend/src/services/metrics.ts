import axios, { AxiosError } from 'axios';
import { 
  addGasUtilizationSample, 
  addErc20TransferCount, 
  addErc721TransferCount,
  // We might need supabaseServiceRole directly for upserting counts if simple insertMetric isn't enough
} from '../lib/supabaseHelpers';

export interface BlockProductionMetrics {
  latestBlock: number | null;
  lastBlockTimeSeconds: number | null; // Time diff between latest and previous block
  txCount: number | null; // Transactions in the latest block
  blockSize: number | null; // In bytes, for the latest block
  gasUsed: number | null; // Gas used in the latest block
  gasLimit: number | null; // Gas limit of the latest block
  latestBlockTimestamp: number | null; // Unix timestamp (seconds) of the latest block
}

export interface SubnetMetrics {
  tps: number | null; // Raw TPS value, calculated from latest two blocks
  blockProduction: BlockProductionMetrics;
  // New metrics to be added based on time-series data stored in DB
  erc20TransferCountsPerMinute: number | null; // Placeholder for now
  erc721TransferCountsPerMinute: number | null; // Placeholder for now
  avgGasUtilizationPercent: number | null; // For the latest block, (gasUsed / gasLimit) * 100
}

interface TransactionInput {
  input: string;
  to?: string | null; // Added for potential ERC20/721 identification
  logs?: Array<{ topics: string[], data: string, address: string }>; // For receipts if we fetch them this way
}

interface BlockDetails {
  number: number;
  timestamp: number;
  transactions: TransactionInput[];
  transactionsCount: number;
  sizeBytes: number;
  gasUsed: number;
  gasLimit: number; // Added gasLimit for the block
}

// Helper to create a more robust RPC URL for health and metrics endpoints
const getBaseUrl = (rpcUrl: string): string => {
  try {
    const url = new URL(rpcUrl);
    // For /ext/health or /ext/metrics, we usually want the base (e.g., http://host:port)
    // If the rpcUrl itself is already the base for these, this is fine.
    // If rpcUrl includes a path (like /ext/bc/C/rpc), we might need to adjust
    // For now, let's assume it's the base or /ext/* paths are relative to it.
    // A common pattern is that /ext/health is on the same host/port as the EVM RPC endpoint.
    return `${url.protocol}//${url.host}`;
  } catch (e) {
    console.warn(`Invalid RPC URL format: ${rpcUrl}. Falling back to using it as is.`);
    return rpcUrl; // Fallback, might not work for all /ext/* paths
  }
};

const fetchEthBlockByNumber = async (rpcUrl: string, blockNumberHex: string, includeFullTransactions: boolean): Promise<BlockDetails | null> => {
  console.log(`Fetching block details for ${blockNumberHex} (fullTx: ${includeFullTransactions}) from: ${rpcUrl}`);
  try {
    const response = await axios.post(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: [blockNumberHex, includeFullTransactions] }, { headers: { 'Content-Type': 'application/json' }, timeout: 7000 });
    if (response.data && response.data.result) {
      const block = response.data.result;
      if (!block) {
        console.error(`Block ${blockNumberHex} not found or null result.`);
        return null;
      }
      const blockNum = parseInt(block.number, 16);
      const timestamp = parseInt(block.timestamp, 16);
      const transactionsArray = block.transactions || [];
      const txCount = transactionsArray.length; // For Blocks, this is correct. For pending, it was different.
      const size = parseInt(block.size, 16);
      const gasUsed = parseInt(block.gasUsed, 16);
      const gasLimit = parseInt(block.gasLimit, 16); // Added gasLimit

      if ([blockNum, timestamp, size, gasUsed, gasLimit].some(Number.isNaN)) {
        console.error('Error parsing block details (num, ts, size, gasUsed, gasLimit) from hex:', block);
        return null;
      }
      
      const processedTransactions: TransactionInput[] = includeFullTransactions 
        ? transactionsArray.map((tx: any) => ({ 
            input: tx.input || '0x', 
            to: tx.to || null, 
            // logs will be populated if/when we fetch receipts per transaction
          })) 
        : [];

      return { number: blockNum, timestamp, transactions: processedTransactions, transactionsCount: txCount, sizeBytes: size, gasUsed, gasLimit };
    } else { console.error(`Invalid response for eth_getBlockByNumber (${blockNumberHex}):`, response.data); return null; }
  } catch (error) { console.error(`Error fetching eth_getBlockByNumber (${blockNumberHex}):`, error instanceof Error ? error.message : error); return null; }
};

const fetchEthLatestBlockInfo = async (rpcUrl: string): Promise<BlockDetails | null> => { // Renamed for clarity
  console.log(`Fetching latest block number from: ${rpcUrl} using eth_blockNumber`);
  try {
    const response = await axios.post(rpcUrl, { jsonrpc: '2.0', id: 2, method: 'eth_blockNumber', params: [] }, { headers: { 'Content-Type': 'application/json' }, timeout: 7000 });
    if (response.data && response.data.result) {
      const blockNumberHex = response.data.result;
      console.log('Successfully fetched latest block number (hex):', blockNumberHex);
      // Fetch full transactions for the latest block to analyze for ERC types if needed, and for gas usage.
      return await fetchEthBlockByNumber(rpcUrl, blockNumberHex, true); 
    } else { console.error('Invalid response for eth_blockNumber:', response.data); return null; }
  } catch (error) { console.error('Error fetching eth_blockNumber:', error instanceof Error ? error.message : error); return null; }
};

const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a123bf2ecdcdffac2282';
const MAX_BLOCKS_PER_ETH_GET_LOGS = 1000; // Configurable: Max range for eth_getLogs

// Interface for transaction receipts (simplified)
interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
  // Add other fields if necessary, like status
}

async function fetchTransactionReceiptsForBlock(rpcUrl: string, blockHash: string): Promise<TransactionReceipt[] | null> {
  // Note: eth_getBlockReceipts is not standard on all chains/nodes.
  // Falling back to fetching all transactions for the block and then receipts one by one if it fails.
  // This can be very RPC intensive for blocks with many transactions.
  // A true `eth_getBlockReceipts` would be far more efficient.
  console.log(`Attempting to fetch all receipts for block ${blockHash} using eth_getBlockReceipts`);
  try {
    const response = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      id: 'getBlockReceipts', // Use a descriptive ID
      method: 'eth_getBlockReceipts', // This is preferred but might not be available
      params: [blockHash]
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }); // Increased timeout

    if (response.data && response.data.result) {
      // Ensure all receipts have blockNumber and blockHash, as eth_getBlockReceipts might omit them if blockHash is a param.
      // The standard response for eth_getBlockReceipts is an array of receipt objects.
      return response.data.result as TransactionReceipt[];
    } else {
      // This path indicates eth_getBlockReceipts might not be supported or returned empty/error
      console.warn(`eth_getBlockReceipts for ${blockHash} returned no result or an error. Response:`, response.data);
      // Fallback or error handling will be managed by the caller or specific error.
      // For now, assume it might fail and we have to rely on eth_getLogs.
      return null; 
    }
  } catch (error) {
    console.warn(`eth_getBlockReceipts failed for block ${blockHash}. This RPC method might not be supported by the subnet. Error: ${error instanceof Error ? error.message : error}`);
    return null; // Indicate failure
  }
}

// This is the main new function for the poller to call
export const fetchAndProcessBlockRangeForTransfersAndGas = async (
  rpcUrl: string,
  subnetId: string,
  fromBlock: number,
  toBlock: number
): Promise<{ lastSuccessfullyProcessedBlock: number | null, erc20Counts: Map<string, number>, erc721Counts: Map<string, number> }> => {
  
  let currentProcessingBlock = fromBlock;
  let lastSuccessfullyProcessedBlock: number | null = fromBlock -1; // Start before the first block in range
  
  // In-memory aggregation for ERC transfers within this processing batch
  const erc20Counts = new Map<string, number>(); // Key: minuteTimestampISO, Value: count
  const erc721Counts = new Map<string, number>();

  console.log(`[Service:fetchAndProcessBlockRange] [${subnetId}] Processing blocks from ${fromBlock} to ${toBlock}`);

  while (currentProcessingBlock <= toBlock) {
    const batchToBlock = Math.min(currentProcessingBlock + MAX_BLOCKS_PER_ETH_GET_LOGS - 1, toBlock);
    console.log(`[Service:fetchAndProcessBlockRange] [${subnetId}] Fetching logs & processing blocks ${currentProcessingBlock} to ${batchToBlock}`);

    try {
      const logsResponse = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 'getLogs',
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${currentProcessingBlock.toString(16)}`,
          toBlock: `0x${batchToBlock.toString(16)}`,
          topics: [TRANSFER_EVENT_TOPIC] // Only Transfer(address,address,uint256/tokenId)
        }]
      }, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }); // Increased timeout

      if (logsResponse.data && logsResponse.data.result) {
        const logs: Array<{ address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string; }> = logsResponse.data.result;
        
        // We need block timestamps. A single eth_getLogs doesn't give block timestamps directly with each log.
        // We need to fetch block details for each block that has logs we care about.
        // Create a map of blockNumber -> blockTimestamp
        const blockTimestamps = new Map<number, number>();
        const uniqueBlockNumbersInBatch = [...new Set(logs.map(log => parseInt(log.blockNumber, 16)))];

        for (const blockNum of uniqueBlockNumbersInBatch) {
          if (!blockTimestamps.has(blockNum)) {
            const blockDetails = await fetchEthBlockByNumber(rpcUrl, `0x${blockNum.toString(16)}`, false);
            if (blockDetails) {
              console.log(`[Service:fetchAndProcessBlockRange] [${subnetId}] Fetched details for block #${blockDetails.number}: GasUsed=${blockDetails.gasUsed}, GasLimit=${blockDetails.gasLimit}, Timestamp=${blockDetails.timestamp}`);
              blockTimestamps.set(blockNum, blockDetails.timestamp);
              
              let utilization = 0;
              if (blockDetails.gasUsed !== null && blockDetails.gasLimit !== null) {
                if (blockDetails.gasLimit > 0) {
                  utilization = parseFloat(((blockDetails.gasUsed / blockDetails.gasLimit) * 100).toFixed(1));
                  console.log(`[Service:fetchAndProcessBlockRange] [${subnetId}] Calculated utilization for block #${blockDetails.number}: ${utilization}%`);
                } else if (blockDetails.gasLimit === 0 && blockDetails.gasUsed === 0) {
                  console.log(`[Service:fetchAndProcessBlockRange] [${subnetId}] Block #${blockDetails.number} is an empty block. Setting utilization to 0.`);
                  utilization = 0;
                } else {
                   console.warn(`[Service:fetchAndProcessBlockRange] [${subnetId}] Block #${blockDetails.number} has gasLimit <= 0 but gasUsed is not 0. GasLimit: ${blockDetails.gasLimit}, GasUsed: ${blockDetails.gasUsed}. Skipping gas utilization storage for this block.`);
                   continue; // Skip addGasUtilizationSample for this block if gasLimit is invalid
                }
                
                console.log(`[Service:fetchAndProcessBlockRange] [${subnetId}] Calling addGasUtilizationSample for historical block #${blockDetails.number}`);
                await addGasUtilizationSample(
                  subnetId,
                  blockDetails.number,
                  new Date(blockDetails.timestamp * 1000).toISOString(),
                  blockDetails.gasUsed,
                  blockDetails.gasLimit,
                  utilization
                );
              } else {
                 console.warn(`[Service:fetchAndProcessBlockRange] [${subnetId}] GasUsed or GasLimit is null for block #${blockDetails.number}. Skipping gas utilization storage.`);
              }
            } else {
              console.warn(`[Service:fetchAndProcessBlockRange] [${subnetId}] Failed to fetch details for block #${blockNum} while processing logs.`);
            }
          }
        }
        
        for (const log of logs) {
          const blockNumber = parseInt(log.blockNumber, 16);
          const blockTimestamp = blockTimestamps.get(blockNumber);

          if (typeof blockTimestamp === 'undefined') {
            console.warn(`[${subnetId}] Missing timestamp for block ${blockNumber} from log processing. Skipping log.`);
            continue;
          }

          const minuteDate = new Date(blockTimestamp * 1000);
          minuteDate.setSeconds(0, 0); // Round to the minute
          const minuteTimestampISO = minuteDate.toISOString();

          // Differentiate ERC20 (3 topics) vs ERC721 (4 topics) for Transfer event
          if (log.topics.length === 3) { // ERC20 Transfer: Transfer(address from, address to, uint256 value)
            erc20Counts.set(minuteTimestampISO, (erc20Counts.get(minuteTimestampISO) || 0) + 1);
          } else if (log.topics.length === 4) { // ERC721 Transfer: Transfer(address from, address to, uint256 tokenId)
            erc721Counts.set(minuteTimestampISO, (erc721Counts.get(minuteTimestampISO) || 0) + 1);
          }
        }
      } else {
        console.warn(`[${subnetId}] eth_getLogs for blocks ${currentProcessingBlock}-${batchToBlock} returned no result or an error. Response:`, logsResponse.data);
      }
      lastSuccessfullyProcessedBlock = batchToBlock; // Mark this batch as processed successfully
    } catch (error) {
      console.error(`[${subnetId}] Error fetching/processing logs for blocks ${currentProcessingBlock}-${batchToBlock}:`, error instanceof Error ? error.message : error);
      // If a batch fails, stop processing for this run to avoid gaps. The next run will retry from lastSuccessfullyProcessedBlock + 1.
      // Or, could implement more granular error handling/retries per block within a batch.
      // For hackathon, stopping on batch error is safer.
      break; 
    }
    currentProcessingBlock = batchToBlock + 1;
  }
  
  // After processing all batches, insert/upsert the aggregated counts
  // This requires the addErc20TransferCount and addErc721TransferCount to perform an upsert.
  // The current `insertMetric` with `Prefer: return=minimal` might need to be changed to `Prefer: resolution=merge-duplicates`
  // if the tables have ON CONFLICT clauses, or we use a stored procedure for atomic increment.
  // For now, assuming addErc...TransferCount can handle this (e.g., by fetching, adding, then updating, or an RPC call)
  // Let's modify supabaseHelpers.ts to support upsert.

  for (const [minuteTimestamp, count] of erc20Counts) {
    await addErc20TransferCount(subnetId, minuteTimestamp, count); // This needs to be an upsert
  }
  for (const [minuteTimestamp, count] of erc721Counts) {
    await addErc721TransferCount(subnetId, minuteTimestamp, count); // This needs to be an upsert
  }

  console.log(`[${subnetId}] Finished processing block range. Last successfully processed block: ${lastSuccessfullyProcessedBlock}`);
  return { lastSuccessfullyProcessedBlock, erc20Counts, erc721Counts };
};

/**
 * Fetches metrics for a given subnet RPC URL.
 * Iteration 1: Fetches real Validator Health. Other metrics are mocked.
 * @param rpcUrl The RPC URL of the subnet.
 * @returns Subnet metrics with real health data and mocked बाकी data.
 */
export const getMetrics = async (rpcUrl: string): Promise<SubnetMetrics> => {
  console.log(`Fetching core metrics from RPC: ${rpcUrl}`);
  
  const latestBlockDetails = await fetchEthLatestBlockInfo(rpcUrl);
  
  let latestBlockNum: number | null = null;
  let transactionsInLatestBlock: number | null = null;
  let latestBlockSize: number | null = null;
  let gasUsedInLatestBlock: number | null = null;
  let gasLimitInLatestBlock: number | null = null;
  let lastBlockTimeSec: number | null = null;
  let tpsValue: number | null = null;
  let avgGasUtilPercent: number | null = null;
  let latestBlockTs: number | null = null; // Added for timestamp

  if (latestBlockDetails) {
    latestBlockNum = latestBlockDetails.number;
    transactionsInLatestBlock = latestBlockDetails.transactionsCount;
    latestBlockSize = latestBlockDetails.sizeBytes;
    gasUsedInLatestBlock = latestBlockDetails.gasUsed;
    gasLimitInLatestBlock = latestBlockDetails.gasLimit;
    latestBlockTs = latestBlockDetails.timestamp; // Capture timestamp

    if (gasUsedInLatestBlock !== null && gasLimitInLatestBlock !== null && gasLimitInLatestBlock > 0) {
      avgGasUtilPercent = parseFloat(((gasUsedInLatestBlock / gasLimitInLatestBlock) * 100).toFixed(1));
    }

    // TPS Calculation (remains the same logic)
    if (latestBlockDetails.number > 0) {
      const prevBlockNumberHex = `0x${(latestBlockDetails.number - 1).toString(16)}`;
      // For TPS, we only need timestamp and tx count, not full transactions of previous block.
      const prevBlockDetails = await fetchEthBlockByNumber(rpcUrl, prevBlockNumberHex, false); 
      if (prevBlockDetails) {
        const timeDiffSeconds = latestBlockDetails.timestamp - prevBlockDetails.timestamp;
        lastBlockTimeSec = timeDiffSeconds >= 0 ? timeDiffSeconds : null;

        if (transactionsInLatestBlock !== null && 
            lastBlockTimeSec !== null && 
            lastBlockTimeSec > 0) {
          tpsValue = parseFloat((transactionsInLatestBlock / lastBlockTimeSec).toFixed(1));
        } else if (transactionsInLatestBlock === 0 && lastBlockTimeSec !== null && lastBlockTimeSec >=0) {
          tpsValue = 0.0;
        }
        // If lastBlockTimeSec is null or 0, tpsValue remains null.
      }
    }
  }
  
  console.log(
    `Core Metrics Data: Latest Block: ${latestBlockNum ?? 'N/A'} (TS: ${latestBlockTs ?? 'N/A'}), TXs: ${transactionsInLatestBlock ?? 'N/A'}, ` +
    `Size (bytes): ${latestBlockSize ?? 'N/A'}, GasUsed: ${gasUsedInLatestBlock ?? 'N/A'}, GasLimit: ${gasLimitInLatestBlock ?? 'N/A'}, ` +
    `Avg Gas Util (%): ${avgGasUtilPercent ?? 'N/A'}, Last Block Time (s): ${lastBlockTimeSec ?? 'N/A'}, TPS: ${tpsValue ?? 'N/A'}`
  );

  return {
    tps: tpsValue,
    blockProduction: {
      latestBlock: latestBlockNum,
      lastBlockTimeSeconds: lastBlockTimeSec,
      txCount: transactionsInLatestBlock,
      blockSize: latestBlockSize,
      gasUsed: gasUsedInLatestBlock,
      gasLimit: gasLimitInLatestBlock,
      latestBlockTimestamp: latestBlockTs, // Pass timestamp
    },
    // These will be fetched from Supabase based on background processing
    erc20TransferCountsPerMinute: null, // Placeholder
    erc721TransferCountsPerMinute: null, // Placeholder
    avgGasUtilizationPercent: avgGasUtilPercent, // This is for the LATEST block
  };
}; 