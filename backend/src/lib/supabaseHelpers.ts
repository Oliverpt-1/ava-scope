import { supabaseServiceRole } from './supabaseServiceRoleClient'; // Import the service role client
import { SubnetMetrics, BlockProductionMetrics } from '../services/metrics'; // Import SubnetMetrics
import { supabase } from './supabaseClient'; // Import the user-context client

// Ensure environment variables are loaded and available
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface Subnet {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  rpc_url: string;
  created_at: string; // Timestamp
}

// --- User-context functions (using supabase client) ---
export const getUserSubnets = async (userId: string): Promise<Subnet[]> => {
  const { data, error } = await supabase
    .from('subnets')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    console.error('Error fetching user subnets:', error);
    throw error;
  }
  return data || [];
};

export const getSubnetRpcUrl = async (subnetId: string): Promise<string | null> => {
  // This could use either the user client or service role client.
  // Using user client implies the user must have access, which is fine for /live endpoint.
  // If service needs to get any RPC URL regardless of user, switch to supabaseServiceRole.
  const { data, error } = await supabase
    .from('subnets')
    .select('rpc_url')
    .eq('id', subnetId)
    .single();

  if (error) {
    console.error(`Error fetching RPC URL for subnet ${subnetId}:`, error);
    return null;
  }
  return data ? data.rpc_url : null;
};

export const addSubnet = async (userId: string, name: string, rpcUrl: string): Promise<Subnet | null> => {
  const { data, error } = await supabase
    .from('subnets')
    .insert([{ user_id: userId, name, rpc_url: rpcUrl }])
    .select();
  if (error) {
    console.error('Error adding subnet:', error);
    throw error;
  }
  return data ? data[0] : null;
};

export const deleteSubnet = async (subnetId: string, userId: string): Promise<{ error: Error | null; count: number | null }> => {
  const { data, error, count } = await supabase
    .from('subnets')
    .delete()
    .eq('id', subnetId)
    .eq('user_id', userId);
  if (error) {
    console.error('Error deleting subnet:', error);
    // Don't throw, let caller handle
  }
  return { error: error as Error | null, count };
};

// --- Metric Sample Insertion Functions (using fetch with service role) ---
async function insertMetric(tableName: string, payload: object | object[], subnetIdForLogging?: string): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[SupabaseHelper:insertMetric] Supabase URL or Service Role Key is not defined. Cannot insert metrics.');
    // For a critical config error like this, re-throwing might be appropriate for the poller to catch and handle, 
    // rather than just logging and continuing as if nothing happened.
    // throw new Error('Supabase environment variables not configured for metrics insertion.');
    return; // Exiting to prevent further errors if config is missing.
  }
  const endpoint = `${SUPABASE_URL}/rest/v1/${tableName}`;
  
  const headers: HeadersInit = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (tableName === 'erc20_transfer_counts' || tableName === 'erc721_transfer_counts') {
    headers['Prefer'] = 'resolution=merge-duplicates,return=minimal';
  } else {
    headers['Prefer'] = 'return=minimal';
  }
  console.log(`[SupabaseHelper:insertMetric] Attempting to POST to ${endpoint} for table ${tableName}. Headers: ${JSON.stringify(headers)}`);
  // console.log(`[SupabaseHelper:insertMetric] Payload for ${tableName}: ${JSON.stringify(payload)}`); // Already logged in addGasUtilizationSample

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    const logSubnetId = subnetIdForLogging || (Array.isArray(payload) && payload.length > 0 ? (payload[0] as any)?.subnet_id : (payload as any)?.subnet_id) || 'unknown';

    if (!response.ok) {
      const errorBody = await response.text(); // Try to get error text from Supabase
      console.error(`[SupabaseHelper:insertMetric] Error adding ${tableName} sample(s) for subnet ${logSubnetId}. Status: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      // Potentially log the failing payload here if it's not too large
      // console.error(`[SupabaseHelper:insertMetric] Failing payload for ${tableName}: ${JSON.stringify(payload)}`);
    } else {
      console.log(`[SupabaseHelper:insertMetric] Successfully inserted data into ${tableName} for subnet ${logSubnetId}. Status: ${response.status}`);
    }
  } catch (error) {
    const logSubnetId = subnetIdForLogging || (Array.isArray(payload) && payload.length > 0 ? (payload[0] as any)?.subnet_id : (payload as any)?.subnet_id) || 'unknown';
    console.error(`[SupabaseHelper:insertMetric] Network or other error when adding ${tableName} sample(s) for subnet ${logSubnetId}:`, error);
  }
}

export const addTpsSample = async (subnetId: string, value: number): Promise<void> => {
  if (value === null || typeof value === 'undefined') return;
  const payload = { 
    subnet_id: subnetId, 
    tps_value: value, 
    sampled_at: new Date().toISOString() 
  };
  await insertMetric('tps_samples', payload, subnetId);
};

export const addBlocktimeSample = async (subnetId: string, blockNumber: number, blockTimeValue: number, blockTimestamp: string): Promise<void> => {
  if (blockTimeValue === null || typeof blockTimeValue === 'undefined' || blockNumber === null || blockTimestamp === null) return;
  const payload = {
    subnet_id: subnetId, 
    block_number: blockNumber, 
    block_time_seconds: blockTimeValue, 
    block_timestamp: blockTimestamp 
  };
  await insertMetric('blocktime_samples', payload, subnetId);
};

// NEW Insertion Functions
export const addGasUtilizationSample = async (
  subnetId: string, 
  blockNumber: number, 
  blockTimestampISO: string, 
  gasUsed: number, 
  gasLimit: number, 
  utilizationPercentageValue: number // Renamed for clarity to avoid conflict with payload key
): Promise<void> => {
  if ([subnetId, blockNumber, blockTimestampISO, gasUsed, gasLimit, utilizationPercentageValue].some(val => val === null || typeof val === 'undefined')) {
    // Log the actual values received in the warning
    console.warn('[SupabaseHelper:addGasUtilizationSample] Attempted to add with null/undefined critical value. Skipping.', 
                 { subnet_id: subnetId, block_number: blockNumber, block_timestamp: blockTimestampISO, gas_used: gasUsed, gas_limit: gasLimit, utilization_percentage: utilizationPercentageValue });
    return;
  }
  const payload = {
    subnet_id: subnetId,
    block_number: blockNumber,
    block_timestamp: blockTimestampISO, // CORRECTED: Matches image schema
    gas_used: gasUsed,
    gas_limit: gasLimit,
    utilization_percentage: utilizationPercentageValue, // CORRECTED: Matches image schema
  };
  console.log('[SupabaseHelper:addGasUtilizationSample] Preparing to insert payload:', JSON.stringify(payload));
  await insertMetric('gas_utilization_samples', payload, subnetId); 
};

export const addErc20TransferCount = async (subnetId: string, minuteTimestamp: string, transferCount: number): Promise<void> => {
  if ([subnetId, minuteTimestamp, transferCount].some(val => val === null || typeof val === 'undefined')) return;
  const payload = {
    subnet_id: subnetId,
    minute_timestamp: minuteTimestamp, // Ensure this is ISO string, rounded to the minute
    transfer_count: transferCount,
  };
  // Upsert to handle cases where a count for that minute already exists and needs updating (e.g. if processing blocks out of order for a minute)
  // Or ensure worker logic aggregates before calling this. For now, simple insert. Add 'Prefer': 'resolution=merge-duplicates' for upsert.
  await insertMetric('erc20_transfer_counts', payload, subnetId);
};

export const addErc721TransferCount = async (subnetId: string, minuteTimestamp: string, transferCount: number): Promise<void> => {
  if ([subnetId, minuteTimestamp, transferCount].some(val => val === null || typeof val === 'undefined')) return;
  const payload = {
    subnet_id: subnetId,
    minute_timestamp: minuteTimestamp, // Ensure this is ISO string, rounded to the minute
    transfer_count: transferCount,
  };
  await insertMetric('erc721_transfer_counts', payload, subnetId);
};

// --- Metric Sample Retrieval Functions (using supabase client) ---

interface TimeRangeOption {
  hours?: number;
  days?: number;
  minutes?: number; // Added for finer grain control if needed
}

const calculateStartTime = (timeRangeOption: TimeRangeOption): string => {
  const now = new Date();
  if (timeRangeOption.hours) {
    now.setHours(now.getHours() - timeRangeOption.hours);
  }
  if (timeRangeOption.days) {
    now.setDate(now.getDate() - timeRangeOption.days);
  }
  if (timeRangeOption.minutes) {
    now.setMinutes(now.getMinutes() - timeRangeOption.minutes);
  }
  return now.toISOString();
};

export interface TpsSample { subnet_id: string; sampled_at: string; tps_value: number; }
export const getTpsSamples = async (subnetId: string, rangeHours: number = 24): Promise<TpsSample[]> => {
  const startTime = calculateStartTime({ hours: rangeHours });
  const { data, error } = await supabase
    .from('tps_samples')
    .select('subnet_id, sampled_at, tps_value')
    .eq('subnet_id', subnetId)
    .gte('sampled_at', startTime)
    .order('sampled_at', { ascending: true });
  if (error) { console.error(`Error fetching tps samples for ${subnetId}:`, error); return []; }
  return data || [];
};

export interface BlocktimeSample { subnet_id: string; block_number: number; block_time_seconds: number; block_timestamp: string; }
export const getBlocktimeSamples = async (subnetId: string, rangeHours: number = 24): Promise<BlocktimeSample[]> => {
  const startTime = calculateStartTime({ hours: rangeHours });
  const { data, error } = await supabase
    .from('blocktime_samples')
    .select('subnet_id, block_number, block_time_seconds, block_timestamp')
    .eq('subnet_id', subnetId)
    .gte('block_timestamp', startTime) // Assuming block_timestamp is the relevant time field
    .order('block_timestamp', { ascending: true });
  if (error) { console.error(`Error fetching blocktime samples for ${subnetId}:`, error); return []; }
  return data || [];
};

// NEW Retrieval Functions
export interface GasUtilizationSample {
  subnet_id: string;
  block_number: number;
  block_timestamp: string;
  gas_used: number;
  gas_limit: number;
  utilization_percentage: number;
}
export const getGasUtilizationSamples = async (subnetId: string, rangeHours: number = 24, limit: number = 1000): Promise<GasUtilizationSample[]> => {
  const startTime = calculateStartTime({ hours: rangeHours });
  // For histogram, we typically want recent data, possibly all data in the range, or latest N points.
  // Defaulting to rangeHours and ordering by block_timestamp descending to get the most recent ones if limited.
  const { data, error } = await supabase
    .from('gas_utilization_samples')
    .select('subnet_id, block_number, block_timestamp, gas_used, gas_limit, utilization_percentage')
    .eq('subnet_id', subnetId)
    .gte('block_timestamp', startTime)
    .order('block_timestamp', { ascending: false }) // Get most recent first
    .limit(limit); 

  if (error) { 
    console.error(`Error fetching gas utilization samples for ${subnetId}:`, error); 
    return []; 
  }
  return (data || []).reverse(); // Reverse to have ascending time for charts
};

export interface ErcTransferCount {
  subnet_id: string;
  minute_timestamp: string;
  transfer_count: number;
}
export const getErc20TransferCounts = async (subnetId: string, rangeHours: number = 24): Promise<ErcTransferCount[]> => {
  const startTime = calculateStartTime({ hours: rangeHours });
  const { data, error } = await supabase
    .from('erc20_transfer_counts')
    .select('subnet_id, minute_timestamp, transfer_count')
    .eq('subnet_id', subnetId)
    .gte('minute_timestamp', startTime)
    .order('minute_timestamp', { ascending: true });
  if (error) { console.error(`Error fetching erc20 transfer counts for ${subnetId}:`, error); return []; }
  return data || [];
};

export const getErc721TransferCounts = async (subnetId: string, rangeHours: number = 24): Promise<ErcTransferCount[]> => {
  const startTime = calculateStartTime({ hours: rangeHours });
  const { data, error } = await supabase
    .from('erc721_transfer_counts')
    .select('subnet_id, minute_timestamp, transfer_count')
    .eq('subnet_id', subnetId)
    .gte('minute_timestamp', startTime)
    .order('minute_timestamp', { ascending: true });
  if (error) { console.error(`Error fetching erc721 transfer counts for ${subnetId}:`, error); return []; }
  return data || [];
};

// --- Average Calculation Functions ---
export const getAverageBlockTime = async (subnetId: string, rangeHours: number = 24): Promise<{ avg_block_time_seconds: number | null, count: number }> => {
  const startTime = calculateStartTime({ hours: rangeHours });

  // Supabase doesn't directly support AVG() in the select string with typed clients in a simple way for this.
  // We fetch the values and calculate the average, or use an RPC call if performance becomes an issue for large datasets.
  // For now, fetch relevant samples:
  const { data, error, count } = await supabase
    .from('blocktime_samples')
    .select('block_time_seconds', { count: 'exact' })
    .eq('subnet_id', subnetId)
    .gte('block_timestamp', startTime);

  if (error) {
    console.error(`Error fetching blocktime samples for average calculation (subnet ${subnetId}):`, error);
    return { avg_block_time_seconds: null, count: 0 };
  }

  if (!data || data.length === 0) {
    return { avg_block_time_seconds: null, count: 0 };
  }

  const sum = data.reduce((acc, sample) => acc + (sample.block_time_seconds || 0), 0);
  const average = sum / data.length;
  
  return { avg_block_time_seconds: parseFloat(average.toFixed(2)), count: count || 0 };
};

export const getAverageTps = async (subnetId: string, rangeHours: number = 24): Promise<{ avg_tps_value: number | null, count: number }> => {
  const startTime = calculateStartTime({ hours: rangeHours });

  const { data, error, count } = await supabase
    .from('tps_samples')
    .select('tps_value', { count: 'exact' })
    .eq('subnet_id', subnetId)
    .gte('sampled_at', startTime);

  if (error) {
    console.error(`Error fetching tps samples for average calculation (subnet ${subnetId}):`, error);
    return { avg_tps_value: null, count: 0 };
  }

  if (!data || data.length === 0) {
    return { avg_tps_value: null, count: 0 };
  }

  const sum = data.reduce((acc, sample) => acc + (sample.tps_value || 0), 0);
  const average = sum / data.length;

  return { avg_tps_value: parseFloat(average.toFixed(1)), count: count || 0 };
};

// NEW function to get the last processed block for extended metrics
export const getLastProcessedBlockForSubnet = async (subnetId: string): Promise<number | null> => {
  const { data, error } = await supabaseServiceRole // Use service role for internal worker logic
    .from('gas_utilization_samples')
    .select('block_number')
    .eq('subnet_id', subnetId)
    .order('block_number', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: 'Standard error: Row not found' - expected if no records
    console.error(`Error fetching last processed block for subnet ${subnetId}:`, error);
    return null;
  }
  return data ? data.block_number : null;
};

// --- Function for Polling Worker ---

interface PollingSubnetInfo {
  id: string;
  rpc_url: string;
  name: string; 
}

export const getAllSubnetsForPolling = async (): Promise<PollingSubnetInfo[]> => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Supabase URL or Service Role Key is not defined. Cannot get subnets for polling.');
    throw new Error('Supabase environment variables not configured for polling setup.');
  }
  const { data, error } = await supabaseServiceRole 
    .from('subnets')
    .select('id, rpc_url, name');

  if (error) {
    console.error('Error fetching all subnets for polling:', error);
    return []; 
  }
  if (!data) {
    return [];
  }
  return data.map(s => ({ id: s.id, rpc_url: s.rpc_url, name: s.name }));
};

// This function is called by the worker after fetching live metrics via getMetrics.
// It will now construct a single payload for the blocktime_samples table,
// including TPS, block time, and the new metrics: gas_used, block_size_bytes, transaction_count.
export const addDirectMetricsSamples = async (subnetId: string, liveMetrics: SubnetMetrics): Promise<void> => {
  const bp = liveMetrics.blockProduction;

  if (bp.latestBlock === null || bp.latestBlockTimestamp === null) {
    console.warn(`[SupabaseHelper:addDirectMetricsSamples] Subnet ${subnetId}: Missing latestBlock or latestBlockTimestamp. Cannot add comprehensive blocktime sample.`);
    return;
  }

  const blocktimeSamplePayload: any = {
    subnet_id: subnetId,
    block_number: bp.latestBlock,
    block_timestamp: new Date(bp.latestBlockTimestamp * 1000).toISOString(),
  };

  if (bp.lastBlockTimeSeconds !== null) {
    blocktimeSamplePayload.block_time_seconds = bp.lastBlockTimeSeconds;
  }
  if (bp.gasUsed !== null) {
    blocktimeSamplePayload.gas_used = bp.gasUsed;
  }
  if (bp.blockSize !== null) {
    blocktimeSamplePayload.block_size_bytes = bp.blockSize;
  }
  if (bp.txCount !== null) {
    blocktimeSamplePayload.transaction_count = bp.txCount;
  }

  try {
    console.log(`[SupabaseHelper:addDirectMetricsSamples] Subnet ${subnetId}: Preparing to insert comprehensive blocktime sample:`, JSON.stringify(blocktimeSamplePayload));
    await insertMetric('blocktime_samples', blocktimeSamplePayload, subnetId);
  } catch (error) {
    console.error(`[SupabaseHelper:addDirectMetricsSamples] Subnet ${subnetId}: Error inserting comprehensive blocktime sample:`, error);
  }
};

// Interface for the data to be inserted into erc_transfer_counts
// This should match the structure expected by the table and the backfill script
export interface ErcTransferBlockData {
  subnet_id: string;
  block_number: number;
  block_timestamp: string; // ISO string
  erc20_transfers: number;
  erc721_transfers: number; // Will be 0 for now from the poller as well
}

// Insert ERC transfer count data into Supabase
// Adapted from the backfillTransfers.ts script
export const insertErcTransferCountsBatch = async (records: ErcTransferBlockData[]): Promise<void> => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[SupabaseHelper:insertErcTransferCountsBatch] Supabase URL or Service Role Key is not defined. Cannot insert records.");
    return;
  }
  if (records.length === 0) {
    // console.log("[SupabaseHelper:insertErcTransferCountsBatch] No records to insert."); // Can be noisy
    return;
  }
  console.log(`[SupabaseHelper:insertErcTransferCountsBatch] Attempting to insert ${records.length} ERC transfer count records...`);

  const endpoint = `${SUPABASE_URL}/rest/v1/erc_transfer_counts`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        // For per-block data, we might want to ignore duplicates if the poller re-processes a block.
        // The table should have a UNIQUE constraint on (subnet_id, block_number) for this to be effective.
        'Prefer': 'return=minimal,resolution=ignore-duplicates', 
      },
      body: JSON.stringify(records),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[SupabaseHelper:insertErcTransferCountsBatch] Error inserting ${records.length} records. Status: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      if (records.length > 0) {
        console.error("[SupabaseHelper:insertErcTransferCountsBatch] First record of failing batch:", JSON.stringify(records[0]));
      }
    } else {
      console.log(`[SupabaseHelper:insertErcTransferCountsBatch] Successfully processed batch insert for ${records.length} ERC transfer count records. Status: ${response.status}`);
    }
  } catch (error) {
    console.error("[SupabaseHelper:insertErcTransferCountsBatch] Network or other error during batch insert:", error);
  }
}; 