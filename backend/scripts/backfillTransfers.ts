import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file in the backend directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AVG_BLOCK_TIME_SECONDS = 5;
const SECONDS_IN_24_HOURS = 60 * 60;
const BLOCKS_IN_24_HOURS = Math.floor(SECONDS_IN_24_HOURS / AVG_BLOCK_TIME_SECONDS);
const BATCH_SIZE = 1000; // Max blocks to fetch logs for in one eth_getLogs call
const INSERT_BATCH_SIZE = 100; // Max records to insert into Supabase in one go for general metrics
const ERC_TRANSFER_INSERT_BATCH_SIZE = 20; // More frequent batching for ERC transfers

const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

interface SubnetConfig {
  id: string;
  name: string;
  rpcUrl: string;
}

interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string; // hex
  transactionHash: string; // hex
  transactionIndex: string; // hex
  blockHash: string; // hex
  logIndex: string; // hex
  removed: boolean;
}

interface BlockTransferData {
  subnet_id: string;
  block_number: number;
  block_timestamp: string; // ISO string
  erc20_transfers: number;
  erc721_transfers: number;
}

// NEW Interfaces for additional metrics
interface BlocktimeSample {
  subnet_id: string;
  block_number: number;
  block_time_seconds: number;
  block_timestamp: string; // ISO
  gas_used: number;
  block_size_bytes: number;
  transaction_count: number;
}

interface TpsSample {
  subnet_id: string;
  block_number: number;
  sampled_at: string; // This will be the block_timestamp in ISO format
  tps_value: number;   // Calculated as tx_count / block_time_seconds
}

interface GasUtilizationSample {
  subnet_id: string;
  block_number: number;
  gas_used: number;
  gas_limit: number;
  utilization_percentage: number;
  block_timestamp: string; // ISO
}

// Interface for the full block structure from eth_getBlockByNumber (simplified)
interface FullBlock {
  hash: string;
  parentHash: string;
  number: string; // hex
  timestamp: string; // hex (seconds)
  transactions: any[]; // Can be array of tx objects or just hashes
  size: string; // hex
  gasUsed: string; // hex
  gasLimit: string; // hex
  // other fields as needed
}

async function makeRpcCall(rpcUrl: string, method: string, params: any[]): Promise<any> {
  console.log(`[RPC] Calling method: ${method}, Params: ${JSON.stringify(params).substring(0, 100)}...`);
  try {
    const response = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      id: method + '_' + Date.now(),
      method: method,
      params: params,
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }); // Increased timeout
    if (response.data.error) {
      console.error(`[RPC Error] Method: ${method}, Error: ${response.data.error.message} (Code: ${response.data.error.code})`);
      throw new Error(`RPC Error (${method}): ${response.data.error.message} (Code: ${response.data.error.code})`);
    }
    console.log(`[RPC Success] Method: ${method}, Result received (first 100 chars): ${JSON.stringify(response.data.result).substring(0,100)}...`);
    return response.data.result;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(`[Axios RPC Error] Method: ${method} to ${rpcUrl}: Status ${error.response.status}`, error.response.data);
    } else {
      console.error(`[Generic RPC Error] Method: ${method} to ${rpcUrl}:`, error);
    }
    throw error;
  }
}

async function getLatestBlockNumber(rpcUrl: string): Promise<number> {
  const blockNumberHex = await makeRpcCall(rpcUrl, 'eth_blockNumber', []);
  return parseInt(blockNumberHex, 16);
}

async function getBlockTimestamp(rpcUrl: string, blockNumber: number): Promise<number | null> {
  try {
    const block = await makeRpcCall(rpcUrl, 'eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, false]);
    if (block && block.timestamp) {
        const ts = parseInt(block.timestamp, 16);
        console.log(`[Timestamp] Block #${blockNumber}: ${ts} (Unix)`);
        return ts;
    }
    console.warn(`[Timestamp Warning] Block #${blockNumber}: No timestamp data in block response.`);
    return null;
  } catch (error) {
    console.warn(`[Timestamp Warning] Error fetching timestamp for block ${blockNumber}. Error:`, error);
    return null;
  }
}

async function getLogs(rpcUrl: string, fromBlock: number, toBlock: number, topics: string[]): Promise<LogEntry[]> {
  const params = [{
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock: `0x${toBlock.toString(16)}`,
    topics: topics,
  }];
  try {
    const logs = await makeRpcCall(rpcUrl, 'eth_getLogs', params);
    return logs || []; // Ensure it always returns an array
  } catch (error) {
    console.error(`[getLogs Error] Range ${fromBlock}-${toBlock}. Returning empty array. Error:`, error);
    return [];
  }
}

// NEW Generic Supabase Insert Function
async function genericSupabaseInsert<T extends Record<string, any>>(
  tableName: string,
  records: T[],
  conflictColumns?: string[]
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(`[Supabase Insert - ${tableName}] Supabase URL or Service Role Key is not defined.`);
    return;
  }
  if (records.length === 0) {
    console.log(`[Supabase Insert - ${tableName}] No records to insert.`);
    return;
  }
  console.log(`[Supabase Insert - ${tableName}] Attempting to insert/upsert ${records.length} records...`);

  let endpoint = `${SUPABASE_URL}/rest/v1/${tableName}`;
  const headers: HeadersInit = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (conflictColumns && conflictColumns.length > 0) {
    endpoint += `?on_conflict=${conflictColumns.join(',')}`;
    (headers as any)['Prefer'] = 'resolution=merge-duplicates';
  } else {
    (headers as any)['Prefer'] = 'return=minimal';
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(records),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Supabase Insert Error - ${tableName}] Failed. Status: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      console.error(`[Supabase Insert Error - ${tableName}] Failing payload (first record):`, JSON.stringify(records.length > 0 ? records[0] : {}));
    } else {
      console.log(`[Supabase Insert Success - ${tableName}] ${records.length} records. Status: ${response.status}`);
    }
  } catch (error) {
    console.error(`[Supabase Insert Error - ${tableName}] Network or other error during batch insert:`, error);
  }
}

async function insertErcTransferCounts(records: BlockTransferData[]): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Supabase Insert] Supabase URL or Service Role Key is not defined. Cannot insert records.");
    return;
  }
  if (records.length === 0) {
    console.log("[Supabase Insert] No records to insert.");
    return;
  }
  console.log(`[Supabase Insert - erc_transfer_counts] Attempting to insert ${records.length} records...`); // Clarified log

  const endpoint = `${SUPABASE_URL}/rest/v1/erc_transfer_counts`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal', // erc_transfer_counts are always new inserts as per original logic
      },
      body: JSON.stringify(records),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Supabase Insert Error - erc_transfer_counts] Failed to insert ${records.length} records. Status: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      console.error("[Supabase Insert Error - erc_transfer_counts] Failing payload (first record):", JSON.stringify(records.length > 0 ? records[0] : {}));
    } else {
      console.log(`[Supabase Insert Success - erc_transfer_counts] Successfully inserted ${records.length} ERC transfer count records. Status: ${response.status}`);
    }
  } catch (error) {
    console.error("[Supabase Insert Error - erc_transfer_counts] Network or other error during batch insert:", error);
  }
}

async function backfillSubnetTransfers(subnet: SubnetConfig) {
  console.log(`[Backfill Main] Starting for subnet: ${subnet.name} (ID: ${subnet.id})`);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Backfill Main] Supabase client not initialized. Check .env file.");
    return;
  }

  // --- Part 1: Backfill Block-based Metrics (Blocktime, TPS, Gas Utilization) ---
  console.log(`[Backfill Metrics] Starting for subnet: ${subnet.name}`);
  try {
    const latestBlockNumber = await getLatestBlockNumber(subnet.rpcUrl);
    console.log(`[Backfill Metrics] Latest block number: ${latestBlockNumber}`);

    const twentyFourHoursAgoSec = Math.floor(Date.now() / 1000) - SECONDS_IN_24_HOURS;
    console.log(`[Backfill Metrics] Fetching blocks until timestamp >= ${twentyFourHoursAgoSec} (Unix)`);

    let blocktimeSamples: BlocktimeSample[] = [];
    let tpsSamples: TpsSample[] = [];
    let gasUtilizationSamples: GasUtilizationSample[] = [];

    let previousBlockTimestamp: number | null = null; // For block_time_seconds calculation, stores timestamp of (currentBlockNum + 1)

    // Iterate backwards from the latest block
    for (let currentBlockNum = latestBlockNumber; currentBlockNum > 0; currentBlockNum--) {
      const blockHex = `0x${currentBlockNum.toString(16)}`;
      let blockData: FullBlock | null = null;
      try {
        blockData = await makeRpcCall(subnet.rpcUrl, 'eth_getBlockByNumber', [blockHex, true]); // true for full tx objects
      } catch (error) {
         console.warn(`[Backfill Metrics] Error fetching block ${currentBlockNum}:`, error);
         previousBlockTimestamp = null; // Reset if block fetch fails
         continue;
      }
      

      if (!blockData || !blockData.timestamp) {
        console.warn(`[Backfill Metrics] Skipping block ${currentBlockNum}: No block data or timestamp received.`);
        previousBlockTimestamp = null; // Reset if a block is invalid
        continue;
      }

      const currentBlockTimestamp = parseInt(blockData.timestamp, 16);
      const blockTimestampISO = new Date(currentBlockTimestamp * 1000).toISOString();

      if (currentBlockTimestamp < twentyFourHoursAgoSec && currentBlockNum < latestBlockNumber) { // Ensure we process at least one block if latest is already too old
        console.log(`[Backfill Metrics] Reached block ${currentBlockNum} with timestamp ${currentBlockTimestamp}, older than 24 hours target. Stopping metric collection.`);
        break; 
      }
      
      console.log(`[Backfill Metrics] Processing block ${currentBlockNum}, Timestamp: ${currentBlockTimestamp}`);

      // 1. Blocktime Sample
      if (previousBlockTimestamp !== null) { // previousBlockTimestamp is from the (newer) block (currentBlockNum + 1)
        const blockTimeSeconds = previousBlockTimestamp - currentBlockTimestamp; 
        const txCountForBlocktime = blockData.transactions ? blockData.transactions.length : 0;
        const blockSizeBytesForBlocktime = blockData.size ? parseInt(blockData.size, 16) : 0;
        const gasUsedForBlocktime = blockData.gasUsed ? parseInt(blockData.gasUsed, 16) : 0;

         if (blockTimeSeconds > 0) { // Ensure blockTimeSeconds is positive for meaningful TPS and blocktime
            blocktimeSamples.push({
                subnet_id: subnet.id,
                block_number: currentBlockNum,
                block_time_seconds: blockTimeSeconds,
                block_timestamp: blockTimestampISO,
                gas_used: gasUsedForBlocktime,
                block_size_bytes: blockSizeBytesForBlocktime,
                transaction_count: txCountForBlocktime,
            });

            // 2. TPS Sample - Calculate and add only if blockTimeSeconds is positive
            const currentBlockTxCount = blockData.transactions ? blockData.transactions.length : 0;
            const calculatedTps = parseFloat((currentBlockTxCount / blockTimeSeconds).toFixed(4)); // Calculate TPS
            tpsSamples.push({
              subnet_id: subnet.id,
              block_number: currentBlockNum,
              sampled_at: blockTimestampISO, // Use block_timestamp for sampled_at
              tps_value: calculatedTps,
            });

        } else {
            console.warn(`[Backfill Metrics] Block ${currentBlockNum}: Zero or negative block_time_seconds (${blockTimeSeconds}). Prev TS: ${previousBlockTimestamp}, Curr TS: ${currentBlockTimestamp}. Skipping blocktime and TPS sample for this block.`);
            // Still add a TPS sample with 0 TPS if block time is not positive, to represent no throughput during that period if desired for tps_samples
            // However, the user's table for tps_samples might not expect this if it's tied to block_number as a key with other tables.
            // For now, only creating TPS sample if blockTimeSeconds > 0.
            // If you need a record for every block in tps_samples regardless of blockTimeSeconds validity, this logic needs adjustment.
             tpsSamples.push({
              subnet_id: subnet.id,
              block_number: currentBlockNum,
              sampled_at: blockTimestampISO,
              tps_value: 0, // Default to 0 if blockTime is not positive
            });
        }
      } else {
        // This is the first block in our backward iteration (latest block), no previous block to calculate time from
        // Or, if previousBlockTimestamp became null due to an error with a newer block
        console.log(`[Backfill Metrics] Block ${currentBlockNum}: No previous block timestamp available. Skipping blocktime sample. Adding TPS sample with 0 value.`);
         tpsSamples.push({
            subnet_id: subnet.id,
            block_number: currentBlockNum,
            sampled_at: blockTimestampISO,
            tps_value: 0, // Default to 0 as blocktime is unknown
          });
      }
      previousBlockTimestamp = currentBlockTimestamp; // Set for the next iteration (which will be currentBlockNum - 1)

      // 3. Gas Utilization Sample
      const gasUsed = blockData.gasUsed ? parseInt(blockData.gasUsed, 16) : 0;
      const gasLimit = blockData.gasLimit ? parseInt(blockData.gasLimit, 16) : 0;
      const utilizationPercentage = gasLimit > 0 ? parseFloat(((gasUsed / gasLimit) * 100).toFixed(2)) : 0;
      gasUtilizationSamples.push({
        subnet_id: subnet.id,
        block_number: currentBlockNum,
        gas_used: gasUsed,
        gas_limit: gasLimit,
        utilization_percentage: utilizationPercentage,
        block_timestamp: blockTimestampISO,
      });

      // Batch insert if needed
      if (blocktimeSamples.length >= INSERT_BATCH_SIZE) {
        await genericSupabaseInsert('blocktime_samples', blocktimeSamples);
        blocktimeSamples = [];
      }
      if (tpsSamples.length >= INSERT_BATCH_SIZE) {
        await genericSupabaseInsert('tps_samples', tpsSamples);
        tpsSamples = [];
      }
      if (gasUtilizationSamples.length >= INSERT_BATCH_SIZE) {
        await genericSupabaseInsert('gas_utilization_samples', gasUtilizationSamples, ['subnet_id', 'block_number']);
        gasUtilizationSamples = [];
      }
    }

    // Insert any remaining records from the metrics collection
    if (blocktimeSamples.length > 0) await genericSupabaseInsert('blocktime_samples', blocktimeSamples);
    if (tpsSamples.length > 0) await genericSupabaseInsert('tps_samples', tpsSamples);
    if (gasUtilizationSamples.length > 0) await genericSupabaseInsert('gas_utilization_samples', gasUtilizationSamples, ['subnet_id', 'block_number']);

    console.log(`[Backfill Metrics] Completed for subnet: ${subnet.name}`);

  } catch (error) {
    console.error(`[Backfill Metrics Critical Error] Subnet ${subnet.name}:`, error);
  }


  // --- Part 2: Existing ERC Transfer Counts Logic ---
  console.log(`[Backfill ERC Transfers] Starting for subnet: ${subnet.name} (ID: ${subnet.id})`);
  try {
    // Use the latestBlockNumber obtained earlier if available, or fetch again.
    // For independence, fetching again as per original structure.
    const latestBlockForLogs = await getLatestBlockNumber(subnet.rpcUrl);
    console.log(`[Backfill ERC Transfers] Latest block for ${subnet.name}: ${latestBlockForLogs}`);
    const endBlockForLogs = latestBlockForLogs;
    const startBlockForLogs = Math.max(0, endBlockForLogs - BLOCKS_IN_24_HOURS); // Approximate 24h window based on avg block time
    console.log(`[Backfill ERC Transfers] Log Range: ${startBlockForLogs} to ${endBlockForLogs} (Approx ${BLOCKS_IN_24_HOURS} blocks)`);

    let allErcBlockDataToInsert: BlockTransferData[] = [];

    for (let currentBatchStart = startBlockForLogs; currentBatchStart <= endBlockForLogs; currentBatchStart += BATCH_SIZE) {
      const currentBatchEnd = Math.min(currentBatchStart + BATCH_SIZE - 1, endBlockForLogs);
      console.log(`[Backfill ERC Transfers] Processing log batch: Blocks ${currentBatchStart} to ${currentBatchEnd}`);

      const logs: LogEntry[] = await getLogs(subnet.rpcUrl, currentBatchStart, currentBatchEnd, [TRANSFER_EVENT_TOPIC]);
      
      console.log(`[Backfill ERC Transfers] Fetched ${logs.length} raw logs for batch ${currentBatchStart}-${currentBatchEnd}.`);
      if (logs.length > 0 && logs[0]) {
          console.log(`[Backfill ERC Transfers] Example log from batch (first log): Address: ${logs[0].address}, Topics: ${JSON.stringify(logs[0].topics)}, Block#: ${parseInt(logs[0].blockNumber, 16)}`);
      }

      if (logs.length === 0) {
        continue;
      }

      const transfersByBlock: Map<number, { count: number, timestamp: number | null }> = new Map();
      const uniqueBlockNumbersInLogBatch = [...new Set(logs.map(log => parseInt(log.blockNumber, 16)))];
      
      console.log(`[Backfill ERC Transfers] Fetching timestamps for ${uniqueBlockNumbersInLogBatch.length} unique blocks in current log batch...`);
      const blockTimestampsMap = new Map<number, number | null>();
      for (const blockNum of uniqueBlockNumbersInLogBatch) {
        // getBlockTimestamp is safe and handles errors internally by returning null
        blockTimestampsMap.set(blockNum, await getBlockTimestamp(subnet.rpcUrl, blockNum));
      }
      console.log(`[Backfill ERC Transfers] Timestamps fetched for ${blockTimestampsMap.size} blocks (some might be null if fetch failed).`);
      
      let parsedTransfersThisBatch = 0;
      for (const log of logs) {
        if (log.topics && log.topics[0] && log.topics[0].toLowerCase() === TRANSFER_EVENT_TOPIC.toLowerCase() && log.topics.length >= 3) {
            const blockNumber = parseInt(log.blockNumber, 16);
            let entry = transfersByBlock.get(blockNumber);
            if (!entry) {
              let ts = blockTimestampsMap.get(blockNumber);
              if (ts === undefined ) { // Should not happen if all unique blocks were processed for timestamps map
                console.warn(`[Backfill ERC Transfers Warning] Timestamp missing from map for block ${blockNumber}. Refetching.`);
                ts = await getBlockTimestamp(subnet.rpcUrl, blockNumber); // Refetch
              }
              // If timestamp is still null after fetching/refetching, it will be handled before push
              entry = { count: 0, timestamp: ts };
              transfersByBlock.set(blockNumber, entry);
            }
            entry.count += 1;
            parsedTransfersThisBatch++;
        } else {
            console.log(`[Backfill ERC Transfers Debug] Log does not match expected Transfer event structure or topic. Log Block: ${parseInt(log.blockNumber,16)}, Topics: ${JSON.stringify(log.topics)}, Expected Topic0: ${TRANSFER_EVENT_TOPIC}`);
        }
      }
      console.log(`[Backfill ERC Transfers] Parsed ${parsedTransfersThisBatch} valid transfer events from logs in this batch.`);

      if (transfersByBlock.size === 0) {
        console.log(`[Backfill ERC Transfers] No blocks with valid transfers after aggregation in batch ${currentBatchStart}-${currentBatchEnd}`);
        continue;
      }
      console.log(`[Backfill ERC Transfers] Aggregated transfers for ${transfersByBlock.size} blocks in current batch.`);

      for (const [blockNumber, data] of transfersByBlock) {
        if (data.timestamp === null) {
          console.warn(`[Backfill ERC Transfers Warning] Could not get/confirm timestamp for block ${blockNumber}. Skipping this block's transfer data.`);
          continue;
        }
        allErcBlockDataToInsert.push({
          subnet_id: subnet.id,
          block_number: blockNumber,
          block_timestamp: new Date(data.timestamp * 1000).toISOString(),
          erc20_transfers: data.count, // As per original script, all are counted as ERC20
          erc721_transfers: 0,        // As per original script
        });

        if (allErcBlockDataToInsert.length >= ERC_TRANSFER_INSERT_BATCH_SIZE) { // Use ERC_TRANSFER_INSERT_BATCH_SIZE here
          console.log(`[Backfill ERC Transfers] Batching ${allErcBlockDataToInsert.length} records for Supabase insert (ERC specific batch)...`);
          await insertErcTransferCounts(allErcBlockDataToInsert);
          allErcBlockDataToInsert = [];
        }
      }
    }

    if (allErcBlockDataToInsert.length > 0) {
      console.log(`[Backfill ERC Transfers] Inserting remaining ${allErcBlockDataToInsert.length} ERC records...`);
      await insertErcTransferCounts(allErcBlockDataToInsert);
    }
    console.log(`[Backfill ERC Transfers] Completed for subnet: ${subnet.name}`);
  } catch (error) {
    console.error(`[Backfill ERC Transfers Critical Error] Subnet ${subnet.name}:`, error);
  }
  console.log(`[Backfill Main] Completed all tasks for subnet: ${subnet.name}`);
}

async function main() {
  const exampleSubnet: SubnetConfig = {
    id: "374877ff-6cd7-4825-9cf3-ba038b480e80", // Beam Subnet ID from your previous logs
    name: "Gunzilla",
    rpcUrl: "https://subnets.avax.network/gunzilla/mainnet/rpc",
  };
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log("[Main] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in .env file. Exiting script.");
    return;
  }
  console.log("[Main] Supabase URL and Service Key loaded. Ready to backfill.");

  // --- Run the backfill for the example subnet ---
  await backfillSubnetTransfers(exampleSubnet); 

  console.log("[Main] Script finished.");
}

main().catch(error => console.error("[Main Unhandled Error]", error));