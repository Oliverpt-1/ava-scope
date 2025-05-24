import { supabase } from './supabase';

export interface BlocktimeSample {
  block_number: number;
  block_time_seconds: number;
  subnet_id?: string; // Added for clarity, though not directly used in this interface post-query
}

export interface BlockStats {
  latestBlockNumber: number | null;
  averageBlockTime: number | null;
}

/**
 * Fetches the latest block number and calculates the average block time
 * over the last 500 blocks for a specific subnet_id from the 'blocktime_samples' Supabase table.
 *
 * @param {string} subnetId The ID of the subnet to filter blocks for.
 * @returns {Promise<BlockStats>} An object containing the latest block number
 *                                and the average block time (rounded to two decimals).
 *                                Returns null for values if data cannot be fetched or processed,
 *                                or if subnetId is not provided.
 */
export const getSupabaseBlockStats = async (subnetId: string): Promise<BlockStats> => {
  const tableName = 'blocktime_samples';

  if (!subnetId) {
    console.warn('subnetId is required for getSupabaseBlockStats');
    return { latestBlockNumber: null, averageBlockTime: null };
  }

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('block_number, block_time_seconds')
      .eq('subnet_id', subnetId) // Added filter for subnet_id
      .order('block_number', { ascending: false })
      .limit(500);

    if (error) {
      console.error(`Error fetching ${tableName} for subnet ${subnetId} from Supabase:`, error);
      return { latestBlockNumber: null, averageBlockTime: null };
    }

    if (!data || data.length === 0) {
      console.warn(`No ${tableName} data received from Supabase for subnet ${subnetId}.`);
      return { latestBlockNumber: null, averageBlockTime: null };
    }

    const typedData = data as BlocktimeSample[];

    const latestBlockNumber = typedData[0].block_number;

    const blockTimes = typedData.map(block => block.block_time_seconds).filter(time => typeof time === 'number');
    if (blockTimes.length === 0) {
        console.warn(`No valid block_time_seconds found in the last 500 blocks for subnet ${subnetId}.`);
        return { latestBlockNumber, averageBlockTime: null };
    }

    const totalBlockTime = blockTimes.reduce((sum, time) => sum + time, 0);
    const averageBlockTime = totalBlockTime / blockTimes.length;

    return {
      latestBlockNumber,
      averageBlockTime: parseFloat(averageBlockTime.toFixed(2)),
    };
  } catch (err) {
    console.error(`An unexpected error occurred in getSupabaseBlockStats for subnet ${subnetId}:`, err);
    return { latestBlockNumber: null, averageBlockTime: null };
  }
}; 