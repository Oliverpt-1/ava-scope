import { supabaseServiceRole } from './supabaseServiceRoleClient'; // Import the service role client
import { SubnetMetrics } from '../services/metrics'; // Import SubnetMetrics
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

// --- Metric Sample Insertion Functions (using fetch) ---
async function insertMetric(tableName: string, payload: object, subnetId: string): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Supabase URL or Service Role Key is not defined. Cannot insert metrics.');
    throw new Error('Supabase environment variables not configured for metrics insertion.');
  }
  const endpoint = `${SUPABASE_URL}/rest/v1/${tableName}`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error adding ${tableName} sample for subnet ${subnetId}. Status: ${response.status}. Body: ${errorBody}`);
    }
  } catch (error) {
    console.error(`Network or other error when adding ${tableName} sample for subnet ${subnetId}:`, error);
  }
}

export const addMempoolSample = async (subnetId: string, value: number): Promise<void> => {
  if (value === null || typeof value === 'undefined') return;
  const payload = { 
    subnet_id: subnetId, 
    pending_tx_count: value, 
    sampled_at: new Date().toISOString() 
  };
  await insertMetric('mempool_samples', payload, subnetId);
};

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

// --- Metric Sample Retrieval Functions (using supabase client) ---

interface TimeRangeOption {
  hours?: number;
  days?: number;
}

const calculateStartTime = (timeRangeOption: TimeRangeOption): string => {
  const now = new Date();
  if (timeRangeOption.hours) {
    now.setHours(now.getHours() - timeRangeOption.hours);
  }
  if (timeRangeOption.days) {
    now.setDate(now.getDate() - timeRangeOption.days);
  }
  return now.toISOString();
};

export interface MempoolSample {
  subnet_id: string;
  sampled_at: string;
  pending_tx_count: number;
  // id and created_at are also present but might not be needed for frontend
}

export const getMempoolSamples = async (subnetId: string, rangeHours: number = 24): Promise<MempoolSample[]> => {
  const startTime = calculateStartTime({ hours: rangeHours });

  const { data, error } = await supabase
    .from('mempool_samples')
    .select('subnet_id, sampled_at, pending_tx_count')
    .eq('subnet_id', subnetId)
    .gte('sampled_at', startTime)
    .order('sampled_at', { ascending: true });

  if (error) {
    console.error(`Error fetching mempool samples for subnet ${subnetId}:`, error);
    // Depending on API design, you might want to throw an error that the route handler can catch
    // and convert to an HTTP error response, or return an empty array/specific error structure.
    return []; 
  }
  return data || [];
};

// Placeholder for future retrieval functions
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

// New function to calculate average block time
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

// New function to calculate average TPS
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

// --- Function for Polling Worker (Still uses supabaseServiceRole client for SELECT) ---

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

export const addAllMetricsSamples = async (subnetId: string, metrics: SubnetMetrics): Promise<void> => {
  const promises = [];

  if (metrics.mempoolSize !== null) {
    promises.push(addMempoolSample(subnetId, metrics.mempoolSize));
  }
  if (metrics.tps !== null) {
    promises.push(addTpsSample(subnetId, metrics.tps));
  }
  
  if (metrics.blockProduction.avgBlockTime !== null && metrics.blockProduction.latestBlock !== null) {
    const latestBlockTimestamp = new Date().toISOString(); 
    promises.push(addBlocktimeSample(
      subnetId, 
      metrics.blockProduction.latestBlock, 
      metrics.blockProduction.avgBlockTime, 
      latestBlockTimestamp 
    ));
  }
  
  try {
    await Promise.all(promises);
  } catch (error) {
    console.error(`Fetch: Error in Promise.all for metric samples, subnet ${subnetId}:`, error);
  }
}; 