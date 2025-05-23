import { supabase } from './supabaseClient';
import { supabaseServiceRole } from './supabaseServiceRoleClient'; // Import the service role client
import { SubnetMetrics } from '../services/metrics'; // Import SubnetMetrics

export interface Subnet {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  rpc_url: string;
  created_at: string; // Timestamp
}

/**
 * Retrieves all subnets for a given user.
 * @param userId The ID of the user.
 * @returns A promise that resolves to an array of subnets.
 */
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

/**
 * Adds a new subnet for a user.
 * @param userId The ID of the user adding the subnet.
 * @param name The name of the subnet.
 * @param rpcUrl The RPC URL of the subnet.
 * @returns A promise that resolves to the newly added subnet.
 */
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

/**
 * Deletes a subnet for a user.
 * @param subnetId The ID of the subnet to delete.
 * @param userId The ID of the user who owns the subnet (for RLS).
 * @returns A promise that resolves when the subnet is deleted.
 */
export const deleteSubnet = async (subnetId: string, userId: string): Promise<{ error: Error | null; count: number | null }> => {
  const { error, count } = await supabase
    .from('subnets')
    .delete()
    .eq('id', subnetId)
    .eq('user_id', userId); // Ensure user can only delete their own subnets

  if (error) {
    console.error('Error deleting subnet:', error);
    // Don't throw here, let the caller handle it based on count and error
  }
  return { error: error as Error | null, count };
};

// --- New Metric Sample Insertion Functions ---

/**
 * Adds a mempool size sample to the database.
 * @param subnetId The ID of the subnet.
 * @param value The mempool size (number of pending transactions).
 */
export const addMempoolSample = async (subnetId: string, value: number): Promise<void> => {
  if (value === null || typeof value === 'undefined') return;
  const { error } = await supabase
    .from('mempool_samples')
    .insert({ subnet_id: subnetId, pending_tx_count: value, sampled_at: new Date().toISOString() });
  if (error) {
    console.error(`Error adding mempool sample for subnet ${subnetId}:`, error);
  }
};

/**
 * Adds a TPS (transactions per second) sample to the database.
 * @param subnetId The ID of the subnet.
 * @param value The calculated TPS.
 */
export const addTpsSample = async (subnetId: string, value: number): Promise<void> => {
  if (value === null || typeof value === 'undefined') return;
  const { error } = await supabase
    .from('tps_samples')
    .insert({ subnet_id: subnetId, tps_value: value, sampled_at: new Date().toISOString() });
  if (error) {
    console.error(`Error adding TPS sample for subnet ${subnetId}:`, error);
  }
};

/**
 * Adds a gas price sample to the database.
 * @param subnetId The ID of the subnet.
 * @param value The gas price in Wei.
 */
export const addGasSample = async (subnetId: string, value: number): Promise<void> => {
  if (value === null || typeof value === 'undefined') return;
  const { error } = await supabase
    .from('gas_samples')
    .insert({ subnet_id: subnetId, gas_price_wei: value, recorded_at: new Date().toISOString() });
  if (error) {
    console.error(`Error adding gas sample for subnet ${subnetId}:`, error);
  }
};

/**
 * Adds a block time sample to the database.
 * @param subnetId The ID of the subnet.
 * @param blockNumber The block number for which this sample is recorded.
 * @param blockTimeValue The time taken for the block (in seconds).
 * @param blockTimestamp The timestamp of the block itself.
 */
export const addBlocktimeSample = async (subnetId: string, blockNumber: number, blockTimeValue: number, blockTimestamp: string): Promise<void> => {
  if (blockTimeValue === null || typeof blockTimeValue === 'undefined' || blockNumber === null || blockTimestamp === null) return;
  const { error } = await supabase
    .from('blocktime_samples')
    .insert({ subnet_id: subnetId, block_number: blockNumber, block_time_seconds: blockTimeValue, block_timestamp: blockTimestamp });
  if (error) {
    console.error(`Error adding block time sample for subnet ${subnetId}:`, error);
  }
};

/**
 * Adds a contract interaction sample to the database.
 * @param subnetId The ID of the subnet.
 * @param value The number of contract interactions in the last block.
 */
export const addContractInteractionSample = async (subnetId: string, value: number): Promise<void> => {
  if (value === null || typeof value === 'undefined') return;
  const { error } = await supabase
    .from('contract_samples') // Assuming table name is 'contract_samples'
    .insert({ subnet_id: subnetId, interaction_count: value, recorded_at: new Date().toISOString() });
  if (error) {
    console.error(`Error adding contract interaction sample for subnet ${subnetId}:`, error);
  }
};

/**
 * Iterates through the SubnetMetrics and adds all non-null samples to their respective tables.
 * @param subnetId The ID of the subnet these metrics belong to.
 * @param metrics The SubnetMetrics object containing all fetched data.
 */
export const addAllMetricsSamples = async (subnetId: string, metrics: SubnetMetrics): Promise<void> => {
  const promises = [];

  if (metrics.mempoolSize !== null) {
    promises.push(addMempoolSample(subnetId, metrics.mempoolSize));
  }
  if (metrics.tps !== null) {
    promises.push(addTpsSample(subnetId, metrics.tps));
  }
  
  // Skipping gasPriceWei for now due to table schema mismatch for gas_samples table.
  // The gas_samples table expects block_number, gas_used, block_timestamp.
  // if (metrics.gasPriceWei !== null) { // THIS LINE WAS THE ISSUE, addGasSample IS COMMENTED OUT, BUT THE CALL WASN'T FULLY.
  //   // promises.push(addGasSample(subnetId, metrics.gasPriceWei)); // addGasSample function is commented out
  // }
  
  if (metrics.blockProduction.avgBlockTime !== null && metrics.blockProduction.latestBlock !== null) {
    const latestBlockTimestamp = new Date().toISOString(); 
    promises.push(addBlocktimeSample(
      subnetId, 
      metrics.blockProduction.latestBlock, 
      metrics.blockProduction.avgBlockTime, 
      latestBlockTimestamp 
    ));
  }
  
  // Skipping contractCalls.total for now as 'contract_samples' table is not in the schema.
  // if (metrics.contractCalls.total !== null) {
  //  // promises.push(addContractInteractionSample(subnetId, metrics.contractCalls.total)); // addContractInteractionSample function is commented out
  // }

  try {
    await Promise.all(promises);
    console.log(`Successfully added available metrics samples for subnet ${subnetId}`);
  } catch (error) {
    console.error(`Error adding one or more metric samples for subnet ${subnetId}:`, error);
  }
};

// --- Function for Polling Worker ---

interface PollingSubnetInfo {
  id: string;
  rpc_url: string;
  name: string; // Added name for logging purposes
}

/**
 * Retrieves all subnets (id, rpc_url, name) from the database for the polling worker.
 * Uses the service role client to bypass RLS.
 * @returns A promise that resolves to an array of subnet info objects.
 */
export const getAllSubnetsForPolling = async (): Promise<PollingSubnetInfo[]> => {
  const { data, error } = await supabaseServiceRole // Use the service role client here
    .from('subnets')
    .select('id, rpc_url, name');

  if (error) {
    console.error('Error fetching all subnets for polling:', error);
    // Depending on how critical this is, we might want to throw the error
    // to stop the poller or let it continue if it can recover.
    // For now, log and return empty, poller will just have no work to do.
    return []; 
  }
  if (!data) {
    console.log('No subnets found for polling.');
    return [];
  }
  console.log(`Found ${data.length} subnets for polling.`);
  return data.map(s => ({ id: s.id, rpc_url: s.rpc_url, name: s.name }));
}; 