import axios, { AxiosError } from 'axios';

export interface ContractCallMetrics {
  total: number | null; // Will be count of txs with input data in last block
  read: number | null;
  write: number | null;
}

export interface BlockProductionMetrics {
  latestBlock: number | null;
  avgBlockTime: number | null; // This is actually last block time in seconds
  txCount: number | null;
  blockSize: number | null; // In bytes
  gasUsedLatestBlock?: number | null; // Gas used in the latest block
}

export interface SubnetMetrics {
  validatorHealth: string;
  uptime: string | null; // Keep as string for "99.9%" or null
  mempoolSize: number | null;
  tps: number | null; // Raw TPS value
  gasPriceWei: number | null; // Current gas price in Wei
  contractCalls: ContractCallMetrics;
  blockProduction: BlockProductionMetrics;
}

interface TransactionInput {
  input: string;
  // Potentially other fields if needed later, like 'to', 'from'
}

interface BlockDetails {
  number: number;
  timestamp: number;
  transactions: TransactionInput[]; // Modified to hold transaction inputs
  transactionsCount: number; // This will be block.transactions.length from original eth_getBlockByNumber
  sizeBytes: number;
  gasUsed: number; // Added gasUsed for the block
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

/**
 * Fetches raw Prometheus metrics from the /ext/metrics endpoint.
 * @param rpcUrl The base RPC URL of the subnet node.
 * @returns A promise that resolves to the raw Prometheus metrics text, or null if an error occurs.
 */
const fetchPrometheusMetrics = async (rpcUrl: string): Promise<string | null> => {
  const baseUrl = getBaseUrl(rpcUrl);
  const metricsUrl = `${baseUrl}/ext/metrics`;
  console.log(`Querying Prometheus metrics at: ${metricsUrl}`);
  try {
    const response = await axios.get(metricsUrl, {
      timeout: 7000,
      validateStatus: (status) => status >= 200 && status < 300, // Only 2xx are valid for Prometheus
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching Prometheus metrics from ${metricsUrl}:`);
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error(`Prometheus Axios Error: ${axiosError.message}`);
      if (axiosError.response) {
        console.error('Prometheus Error Response Data:', axiosError.response.data);
        console.error('Prometheus Error Response Status:', axiosError.response.status);
      }
    } else {
      console.error('Unexpected non-Axios error fetching Prometheus metrics:', error);
    }
    return null;
  }
};

/**
 * Parses a specific metric value from raw Prometheus metrics text.
 * Looks for lines like: metric_name{labels} value
 * @param metricsText The raw Prometheus metrics text.
 * @param metricName The name of the metric to parse.
 * @returns The numeric value of the metric, or null if not found or not a number.
 */
const parsePrometheusMetric = (metricsText: string, metricName: string): number | null => {
  if (!metricsText) return null;
  // Basic regex: matches lines starting with the metric name, possibly followed by labels, then captures the number.
  // This is a simplified parser; robust Prometheus clients use more complex parsing.
  const regex = new RegExp(`^${metricName}(?:\{[^}]*\})?\s+([\d.]+)`, 'm');
  const match = metricsText.match(regex);
  if (match && match[1]) {
    const value = parseFloat(match[1]);
    return Number.isNaN(value) ? null : value;
  }
  console.warn(`Metric ${metricName} not found or invalid format in Prometheus output.`);
  return null;
};

const fetchEthPendingTransactionCount = async (rpcUrl: string): Promise<number | null> => {
  console.log(`Fetching pending tx count from: ${rpcUrl}`);
  try {
    const response = await axios.post(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'eth_getBlockTransactionCountByNumber', params: ['pending'] }, { headers: { 'Content-Type': 'application/json' }, timeout: 7000 });
    if (response.data && response.data.result) {
      const countHex = response.data.result;
      const countDecimal = parseInt(countHex, 16);
      if (Number.isNaN(countDecimal)) { console.error('Error parsing pending tx count from hex:', countHex); return null; }
      console.log('Successfully fetched pending tx count:', countDecimal);
      return countDecimal;
    } else { console.error('Invalid response for eth_getBlockTransactionCountByNumber:', response.data); return null; }
  } catch (error) { console.error('Error fetching eth_getBlockTransactionCountByNumber:', error instanceof Error ? error.message : error); return null; }
};

const fetchEthBlockByNumber = async (rpcUrl: string, blockNumberHex: string, includeFullTransactions: boolean): Promise<BlockDetails | null> => {
  console.log(`Fetching block details for ${blockNumberHex} (fullTx: ${includeFullTransactions}) from: ${rpcUrl}`);
  try {
    const response = await axios.post(rpcUrl, { jsonrpc: '2.0', id: 3, method: 'eth_getBlockByNumber', params: [blockNumberHex, includeFullTransactions] }, { headers: { 'Content-Type': 'application/json' }, timeout: 7000 });
    if (response.data && response.data.result) {
      const block = response.data.result;
      if (!block) { // Handle null block result (e.g. block not found)
        console.error(`Block ${blockNumberHex} not found or null result.`);
        return null;
      }
      const blockNum = parseInt(block.number, 16);
      const timestamp = parseInt(block.timestamp, 16);
      const transactionsArray = block.transactions || [];
      const txCount = transactionsArray.length;
      const size = parseInt(block.size, 16);
      const gasUsed = parseInt(block.gasUsed, 16);

      if ([blockNum, timestamp, size, gasUsed].some(Number.isNaN)) {
        console.error('Error parsing block details (num, ts, size, gasUsed) from hex:', block);
        return null;
      }
      // Extract only necessary transaction info (input) to keep BlockDetails light if fullTx=true
      const processedTransactions: TransactionInput[] = includeFullTransactions 
        ? transactionsArray.map((tx: any) => ({ input: tx.input || '0x' })) 
        : []; // If not including full tx, this will be empty. TxCount is still valid.

      return { number: blockNum, timestamp, transactions: processedTransactions, transactionsCount: txCount, sizeBytes: size, gasUsed };
    } else { console.error(`Invalid response for eth_getBlockByNumber (${blockNumberHex}):`, response.data); return null; }
  } catch (error) { console.error(`Error fetching eth_getBlockByNumber (${blockNumberHex}):`, error instanceof Error ? error.message : error); return null; }
};

const fetchEthLatestBlockNumberInfo = async (rpcUrl: string): Promise<BlockDetails | null> => {
  console.log(`Fetching latest block number from: ${rpcUrl} using eth_blockNumber`);
  try {
    const response = await axios.post(rpcUrl, { jsonrpc: '2.0', id: 2, method: 'eth_blockNumber', params: [] }, { headers: { 'Content-Type': 'application/json' }, timeout: 7000 });
    if (response.data && response.data.result) {
      const blockNumberHex = response.data.result;
      console.log('Successfully fetched latest block number (hex):', blockNumberHex);
      return await fetchEthBlockByNumber(rpcUrl, blockNumberHex, true); // Fetch full transactions for the latest block
    } else { console.error('Invalid response for eth_blockNumber:', response.data); return null; }
  } catch (error) { console.error('Error fetching eth_blockNumber:', error instanceof Error ? error.message : error); return null; }
};

/**
 * Fetches the current gas price using eth_gasPrice.
 * @param rpcUrl The EVM JSON-RPC URL.
 * @returns A promise that resolves to the gas price in Gwei as a string (e.g., "20.5 Gwei"), or null if an error occurs.
 */
const fetchEthGasPriceWei = async (rpcUrl: string): Promise<number | null> => {
  console.log(`Fetching current gas price from: ${rpcUrl} using eth_gasPrice`);
  try {
    const response = await axios.post(rpcUrl, { jsonrpc: '2.0', id: 4, method: 'eth_gasPrice', params: [] }, { headers: { 'Content-Type': 'application/json' }, timeout: 7000 });
    if (response.data && response.data.result) {
      const gasPriceHex = response.data.result;
      const gasPriceWei = parseInt(gasPriceHex, 16);
      if (Number.isNaN(gasPriceWei)) {
        console.error('Error parsing gas price from hex:', gasPriceHex);
        return null;
      }
      console.log('Successfully fetched gas price (Wei):', gasPriceWei);
      return gasPriceWei;
    } else {
      console.error('Invalid response for eth_gasPrice:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Error fetching eth_gasPrice:', error instanceof Error ? error.message : error);
    return null;
  }
};

/**
 * Fetches metrics for a given subnet RPC URL.
 * Iteration 1: Fetches real Validator Health. Other metrics are mocked.
 * @param rpcUrl The RPC URL of the subnet.
 * @returns Subnet metrics with real health data and mocked बाकी data.
 */
export const getMetrics = async (rpcUrl: string): Promise<SubnetMetrics> => {
  console.log(`Fetching real metrics from RPC: ${rpcUrl}`);
  
  const pendingCount = await fetchEthPendingTransactionCount(rpcUrl);
  const mempoolValue: number | null = pendingCount !== null ? pendingCount : null;
  console.log(`Final mempool size determined: ${mempoolValue !== null ? mempoolValue : 'N/A'}`);

  const currentGasPriceWei = await fetchEthGasPriceWei(rpcUrl);
  const gasPriceWeiValue: number | null = currentGasPriceWei !== null ? currentGasPriceWei : null;
  console.log(`Final gas price (Wei) determined: ${gasPriceWeiValue !== null ? gasPriceWeiValue : 'N/A'}`);

  const latestBlockDetails = await fetchEthLatestBlockNumberInfo(rpcUrl);
  
  let latestBlockNum: number | null = null;
  let transactionsInLatestBlock: number | null = null;
  let latestBlockSize: number | null = null;
  let gasUsedInLatestBlock: number | null = null;
  let lastBlockTimeSec: number | null = null;
  let contractInteractionsInLastBlock: number | null = null;
  let tpsValue: number | null = null;

  if (latestBlockDetails) {
    latestBlockNum = latestBlockDetails.number;
    transactionsInLatestBlock = latestBlockDetails.transactionsCount;
    latestBlockSize = latestBlockDetails.sizeBytes;
    gasUsedInLatestBlock = latestBlockDetails.gasUsed;

    const interactions = latestBlockDetails.transactions.filter(tx => tx.input && tx.input !== '0x').length;
    contractInteractionsInLastBlock = interactions;

    if (latestBlockDetails.number > 0) {
      const prevBlockNumberHex = `0x${(latestBlockDetails.number - 1).toString(16)}`;
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
        } else {
          tpsValue = null;
        }
      } else { 
        lastBlockTimeSec = null;
        tpsValue = null;
      }
    }
  }
  
  console.log(
    `Metrics Data: Latest Block: ${latestBlockNum ?? 'N/A'}, TXs: ${transactionsInLatestBlock ?? 'N/A'}, ` +
    `Interactions: ${contractInteractionsInLastBlock ?? 'N/A'}, Size (bytes): ${latestBlockSize ?? 'N/A'}, ` +
    `GasUsed (block): ${gasUsedInLatestBlock ?? 'N/A'}, Last Block Time (s): ${lastBlockTimeSec ?? 'N/A'}, ` +
    `TPS: ${tpsValue ?? 'N/A'}, Mempool: ${mempoolValue ?? 'N/A'}, GasPrice (Wei): ${gasPriceWeiValue ?? 'N/A'}`
  );

  return {
    validatorHealth: "N/A (Public RPC - Health check skipped)",
    mempoolSize: mempoolValue,
    uptime: "(mocked) 99.9%",
    tps: tpsValue,
    gasPriceWei: gasPriceWeiValue,
    contractCalls: { 
      total: contractInteractionsInLastBlock,
      read: null,
      write: null
    },
    blockProduction: {
      latestBlock: latestBlockNum,
      avgBlockTime: lastBlockTimeSec,
      txCount: transactionsInLatestBlock,
      blockSize: latestBlockSize,
      gasUsedLatestBlock: gasUsedInLatestBlock,
    },
  };
}; 