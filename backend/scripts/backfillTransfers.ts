import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file in the backend directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AVG_BLOCK_TIME_SECONDS = 5;
const SECONDS_IN_24_HOURS = 24 * 60 * 60;
const BLOCKS_IN_24_HOURS = Math.floor(SECONDS_IN_24_HOURS / AVG_BLOCK_TIME_SECONDS);
const BATCH_SIZE = 1000; // Max blocks to fetch logs for in one eth_getLogs call
const INSERT_BATCH_SIZE = 100; // Max records to insert into Supabase in one go

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

async function insertErcTransferCounts(records: BlockTransferData[]): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Supabase Insert] Supabase URL or Service Role Key is not defined. Cannot insert records.");
    return;
  }
  if (records.length === 0) {
    console.log("[Supabase Insert] No records to insert.");
    return;
  }
  console.log(`[Supabase Insert] Attempting to insert ${records.length} records...`);
  // console.log("[Supabase Insert] First record preview:", JSON.stringify(records[0])); // Optional: log first record

  const endpoint = `${SUPABASE_URL}/rest/v1/erc_transfer_counts`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(records),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Supabase Insert Error] Failed to insert ${records.length} records. Status: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      console.error("[Supabase Insert Error] Failing payload (first record):", JSON.stringify(records.length > 0 ? records[0] : {}));
    } else {
      console.log(`[Supabase Insert Success] Successfully inserted ${records.length} ERC transfer count records. Status: ${response.status}`);
    }
  } catch (error) {
    console.error("[Supabase Insert Error] Network or other error during batch insert:", error);
  }
}

async function backfillSubnetTransfers(subnet: SubnetConfig) {
  console.log(`[Backfill] Starting for subnet: ${subnet.name} (ID: ${subnet.id})`);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Backfill] Supabase client not initialized. Check .env file.");
    return;
  }

  try {
    const latestBlock = await getLatestBlockNumber(subnet.rpcUrl);
    console.log(`[Backfill] Latest block for ${subnet.name}: ${latestBlock}`);
    const endBlock = latestBlock;
    const startBlock = Math.max(0, endBlock - BLOCKS_IN_24_HOURS);
    console.log(`[Backfill] Range: ${startBlock} to ${endBlock} (Approx 24 hours, total ${endBlock - startBlock} blocks)`);

    let allBlockDataToInsert: BlockTransferData[] = [];

    for (let currentBatchStart = startBlock; currentBatchStart <= endBlock; currentBatchStart += BATCH_SIZE) {
      const currentBatchEnd = Math.min(currentBatchStart + BATCH_SIZE - 1, endBlock);
      console.log(`[Backfill] Processing log batch: Blocks ${currentBatchStart} to ${currentBatchEnd}`);

      const logs: LogEntry[] = await getLogs(subnet.rpcUrl, currentBatchStart, currentBatchEnd, [TRANSFER_EVENT_TOPIC]);
      
      console.log(`[Backfill] Fetched ${logs.length} raw logs for batch ${currentBatchStart}-${currentBatchEnd}.`);
      if (logs.length > 0) {
          console.log(`[Backfill] Example log from batch (first log): Address: ${logs[0].address}, Topics: ${JSON.stringify(logs[0].topics)}, Block#: ${parseInt(logs[0].blockNumber, 16)}`);
      }

      if (logs.length === 0) {
        continue;
      }

      const transfersByBlock: Map<number, { count: number, timestamp: number | null }> = new Map();
      const uniqueBlockNumbersInLogBatch = [...new Set(logs.map(log => parseInt(log.blockNumber, 16)))];
      
      console.log(`[Backfill] Fetching timestamps for ${uniqueBlockNumbersInLogBatch.length} unique blocks in current log batch...`);
      const blockTimestampsMap = new Map<number, number | null>();
      for (const blockNum of uniqueBlockNumbersInLogBatch) {
        blockTimestampsMap.set(blockNum, await getBlockTimestamp(subnet.rpcUrl, blockNum));
      }
      console.log(`[Backfill] Timestamps fetched for ${blockTimestampsMap.size} blocks.`);
      
      let parsedTransfersThisBatch = 0;
      for (const log of logs) {
        // Basic check: topic[0] is the event signature, topic[1] is sender, topic[2] is receiver
        // For a standard Transfer event, topics array should have at least 3 elements
        if (log.topics && log.topics[0] && log.topics[0].toLowerCase() === TRANSFER_EVENT_TOPIC.toLowerCase() && log.topics.length >= 3) {
            const blockNumber = parseInt(log.blockNumber, 16);
            let entry = transfersByBlock.get(blockNumber);
            if (!entry) {
              const ts = blockTimestampsMap.get(blockNumber);
              if (ts === undefined) { // Should not happen if all unique blocks were processed
                console.warn(`[Backfill Warning] Timestamp missing from map for block ${blockNumber}. Refetching.`);
                entry = { count: 0, timestamp: await getBlockTimestamp(subnet.rpcUrl, blockNumber) };
              } else {
                entry = { count: 0, timestamp: ts };
              }
              transfersByBlock.set(blockNumber, entry);
            }
            entry.count += 1;
            parsedTransfersThisBatch++;
        } else {
            console.log(`[Backfill Debug] Log does not match expected Transfer event structure or topic. Topics: ${JSON.stringify(log.topics)}, Expected Topic0: ${TRANSFER_EVENT_TOPIC}`);
        }
      }
      console.log(`[Backfill] Parsed ${parsedTransfersThisBatch} valid transfer events from logs in this batch.`);

      if (transfersByBlock.size === 0) {
        console.log(`[Backfill] No blocks with valid transfers after aggregation in batch ${currentBatchStart}-${currentBatchEnd}`);
        continue;
      }
      console.log(`[Backfill] Aggregated transfers for ${transfersByBlock.size} blocks in current batch.`);

      for (const [blockNumber, data] of transfersByBlock) {
        if (data.timestamp === null) {
          console.warn(`[Backfill Warning] Could not get/confirm timestamp for block ${blockNumber}. Skipping this block's transfer data.`);
          continue;
        }
        allBlockDataToInsert.push({
          subnet_id: subnet.id,
          block_number: blockNumber,
          block_timestamp: new Date(data.timestamp * 1000).toISOString(),
          erc20_transfers: data.count,
          erc721_transfers: 0,
        });

        if (allBlockDataToInsert.length >= INSERT_BATCH_SIZE) {
          console.log(`[Backfill] Batching ${allBlockDataToInsert.length} records for Supabase insert...`);
          await insertErcTransferCounts(allBlockDataToInsert);
          allBlockDataToInsert = [];
        }
      }
    }

    if (allBlockDataToInsert.length > 0) {
      console.log(`[Backfill] Inserting remaining ${allBlockDataToInsert.length} records...`);
      await insertErcTransferCounts(allBlockDataToInsert);
    }
    console.log(`[Backfill] Completed for subnet: ${subnet.name}`);
  } catch (error) {
    console.error(`[Backfill Critical Error] Subnet ${subnet.name}:`, error);
  }
}

async function main() {
  const exampleSubnet: SubnetConfig = {
    id: "3e9c1756-d1a4-4157-ab58-1ce127a8e0bf", // Beam Subnet ID from your previous logs
    name: "Beam (AvaScope Test)",
    rpcUrl: "https://subnets.avax.network/beam/mainnet/rpc",
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