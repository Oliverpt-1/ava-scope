import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import MetricCard from './MetricCard';

interface TransactionMetricsProps {
  tps: number | null;
  loading?: boolean;
}

const TransactionMetrics: React.FC<TransactionMetricsProps> = ({ tps, loading = false }) => {
  const displayTps = tps !== null ? `${tps.toFixed(1)} TPS` : 'N/A';

  return (
    <MetricCard
      title="Transaction Throughput"
      value={displayTps}
      icon={<ArrowUpDown size={24} className="text-red-500" />}
      tooltipText="Average transactions per second (TPS) based on recent activity."
      loading={loading}
    />
  );
};

export default TransactionMetrics;