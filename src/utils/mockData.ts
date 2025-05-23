import { DashboardData } from '../types';

// Generate random data for sparklines and charts
const generateRandomArray = (length: number, min: number, max: number): number[] => {
  return Array.from({ length }, () => Math.floor(Math.random() * (max - min + 1)) + min);
};

export const MOCK_DASHBOARD_DATA: DashboardData = {
  validator: {
    status: 'healthy',
    uptime: 99.98,
    last_block_time: Date.now() - 3000, // 3 seconds ago
  },
  mempool: {
    size: 156,
    history: generateRandomArray(10, 50, 200),
  },
  transactions: {
    tps: 34.7,
    history: generateRandomArray(20, 10, 60),
  },
  gas: {
    average: 23.5,
    history: generateRandomArray(7, 15, 30),
  },
  contracts: {
    read: 7824,
    write: 3251,
  },
  blocks: [
    {
      height: 1234567,
      timestamp: Date.now() - 2000,
      size: 1024,
      transactions: 78,
      gas_used: 23451,
    },
    {
      height: 1234566,
      timestamp: Date.now() - 14000,
      size: 987,
      transactions: 65,
      gas_used: 19876,
    },
    {
      height: 1234565,
      timestamp: Date.now() - 26000,
      size: 1152,
      transactions: 82,
      gas_used: 25432,
    },
    {
      height: 1234564,
      timestamp: Date.now() - 38000,
      size: 864,
      transactions: 54,
      gas_used: 17543,
    },
    {
      height: 1234563,
      timestamp: Date.now() - 50000,
      size: 1095,
      transactions: 73,
      gas_used: 21987,
    },
  ],
};