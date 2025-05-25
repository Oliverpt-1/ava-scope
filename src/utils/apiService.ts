import { supabase } from './supabase'; // Assuming your frontend Supabase client is in src/utils/supabase.ts

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'; // Adjust if your env var is different

interface ApiServiceError {
  error: string;
  details?: any;
}

// Helper to get the current session and token
const getAuthHeader = async (): Promise<HeadersInit | null> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    console.error('Error getting session or no session found:', error);
    return null;
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
};

// --- Metric Average Fetch Functions ---
export interface AverageDataResponse {
  avg_value: number | null; // Generic for avg_tps_value or avg_block_time_seconds
  count: number;
}

export const fetchAverageTps = async (subnetId: string, rangeHours: number = 24): Promise<AverageDataResponse | ApiServiceError> => {
  const headers = await getAuthHeader();
  if (!headers) return { error: 'User not authenticated' };

  try {
    const response = await fetch(`${API_BASE_URL}/metrics/${subnetId}/tps/average?rangeHours=${rangeHours}`, {
      method: 'GET',
      headers: headers,
    });
    if (!response.ok) {
      const errData = await response.json();
      return { error: `Failed to fetch average TPS: ${response.status}`, details: errData };
    }
    const data = await response.json();
    return { avg_value: data.avg_tps_value, count: data.count };
  } catch (error: any) {
    console.error('Network error fetching average TPS:', error);
    return { error: 'Network error fetching average TPS', details: error.message };
  }
};

export const fetchAverageBlockTime = async (subnetId: string, rangeHours: number = 24): Promise<AverageDataResponse | ApiServiceError> => {
  const headers = await getAuthHeader();
  if (!headers) return { error: 'User not authenticated' };

  try {
    const response = await fetch(`${API_BASE_URL}/metrics/${subnetId}/blocktime/average?rangeHours=${rangeHours}`, {
      method: 'GET',
      headers: headers,
    });
    if (!response.ok) {
      const errData = await response.json();
      return { error: `Failed to fetch average block time: ${response.status}`, details: errData };
    }
    const data = await response.json();
    return { avg_value: data.avg_block_time_seconds, count: data.count }; 
  } catch (error: any) {
    console.error('Network error fetching average block time:', error);
    return { error: 'Network error fetching average block time', details: error.message };
  }
};

// --- Blocktime Samples Fetch Function ---
export interface BlocktimeSampleFE {
  subnet_id: string;
  block_number: number;
  block_time_seconds: number;
  block_timestamp: string;
}

export const fetchBlocktimeSamples = async (subnetId: string, rangeHours: number = 24): Promise<BlocktimeSampleFE[] | ApiServiceError> => {
  const headers = await getAuthHeader();
  if (!headers) return { error: 'User not authenticated' };

  try {
    const response = await fetch(`${API_BASE_URL}/metrics/${subnetId}/blocktime?rangeHours=${rangeHours}`, {
      method: 'GET',
      headers: headers,
    });
    if (!response.ok) {
      const errData = await response.json();
      return { error: `Failed to fetch blocktime samples: ${response.status}`, details: errData };
    }
    return await response.json() as BlocktimeSampleFE[];
  } catch (error: any) {
    console.error('Network error fetching blocktime samples:', error);
    return { error: 'Network error fetching blocktime samples', details: error.message };
  }
};

// --- AvaCloud Metrics Fetchers ---
export const fetchTeleporterMetric = async (
  chainId: string,
  metric: 'teleporterSourceTxnCount' | 'teleporterDestinationTxnCount' | 'teleporterTotalTxnCount'
): Promise<any | ApiServiceError> => {
  const headers = await getAuthHeader();
  if (!headers) return { error: 'User not authenticated' };

  try {
    const url = `${API_BASE_URL}/avacloud/teleporter?chainId=${chainId}&metric=${metric}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const errData = await response.json();
      return { error: `Failed to fetch teleporter metric: ${response.status}`, details: errData };
    }
    return await response.json();
  } catch (error: any) {
    console.error('Network error fetching teleporter metric:', error);
    return { error: 'Network error fetching teleporter metric', details: error.message };
  }
};

export const fetchStakingMetric = async (
  network: 'mainnet' | 'fuji' | 'testnet',
  metric: 'delegatorCount' | 'delegatorWeight' | 'validatorCount' | 'validatorWeight',
  options?: { startTimestamp?: number; endTimestamp?: number; subnetId?: string }
): Promise<any | ApiServiceError> => {
  const headers = await getAuthHeader();
  if (!headers) return { error: 'User not authenticated' };

  const params = new URLSearchParams({ network, metric });
  if (options?.startTimestamp) params.append('startTimestamp', options.startTimestamp.toString());
  if (options?.endTimestamp) params.append('endTimestamp', options.endTimestamp.toString());
  if (options?.subnetId) params.append('subnetId', options.subnetId);

  try {
    const response = await fetch(`${API_BASE_URL}/avacloud/staking?${params.toString()}`, { headers });
    if (!response.ok) {
      const errData = await response.json();
      return { error: `Failed to fetch staking metric: ${response.status}`, details: errData };
    }
    return await response.json();
  } catch (error: any) {
    console.error('Network error fetching staking metric:', error);
    return { error: 'Network error fetching staking metric', details: error.message };
  }
};

export const fetchChainMetric = async (
  chainId: string,
  metric: string,
  options?: {
    startTimestamp?: number;
    endTimestamp?: number;
    timeInterval?: 'hour' | 'day' | 'week' | 'month';
  }
): Promise<any | ApiServiceError> => {
  const headers = await getAuthHeader();
  if (!headers) return { error: 'User not authenticated' };

  const params = new URLSearchParams({ chainId, metric });
  if (options?.startTimestamp) params.append('startTimestamp', options.startTimestamp.toString());
  if (options?.endTimestamp) params.append('endTimestamp', options.endTimestamp.toString());
  if (options?.timeInterval) params.append('timeInterval', options.timeInterval);

  try {
    const response = await fetch(`${API_BASE_URL}/avacloud/chain?${params.toString()}`, { headers });
    if (!response.ok) {
      const errData = await response.json();
      return { error: `Failed to fetch chain metric: ${response.status}`, details: errData };
    }
    return await response.json();
  } catch (error: any) {
    console.error('Network error fetching chain metric:', error);
    return { error: 'Network error fetching chain metric', details: error.message };
  }
}; 