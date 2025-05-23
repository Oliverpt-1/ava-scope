import { supabase } from './supabaseClient';

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