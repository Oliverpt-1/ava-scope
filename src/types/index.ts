export interface User {
  id: string;
  email: string;
  avatar_url?: string;
}

export interface Subnet {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  rpc_url: string;
  created_at: string; // Timestamp
}

export interface MetricCardProps {
  title: string;
  value?: string | number;
  icon: React.ReactNode;
  trend?: number;
  chart?: React.ReactNode;
  tooltipText?: string;
  loading?: boolean;
}

export interface BlockData {
  height: number;
  timestamp: number;
  size: number;
  transactions: number;
  gas_used: number;
}

export interface TransactionData {
  tps: number;
  history: number[];
}

export interface MempoolData {
  size: number;
  history: number[];
}

export interface GasData {
  average: number;
  history: number[];
}

export interface ContractData {
  read: number;
  write: number;
}

export interface ValidatorData {
  status: 'healthy' | 'warning' | 'error';
  uptime: number;
  last_block_time: number;
}

export interface DashboardData {
  validator: ValidatorData;
  mempool: MempoolData;
  transactions: TransactionData;
  gas: GasData;
  contracts: ContractData;
  blocks: BlockData[];
}

export interface ContractCallMetrics {
  total: number;
  read: number; // Percentage
  write: number; // Percentage
}

export interface BlockProductionMetrics {
  latestBlock: number;
  avgBlockTime: number; // Seconds
  txCount: number;
  blockSize: number; // Bytes
}

export interface SubnetMetrics {
  validatorHealth: string;
  uptime: number; // Percentage
  mempoolSize: number;
  tps: number; // Transactions per second
  gasUsage: number; // Percentage or Gwei
  contractCalls: ContractCallMetrics;
  blockProduction: BlockProductionMetrics;
}