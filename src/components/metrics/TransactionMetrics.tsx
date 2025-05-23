import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import MetricCard from './MetricCard';
import { TransactionData } from '../../types';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface TransactionMetricsProps {
  data: TransactionData;
  loading?: boolean;
}

const TransactionMetrics: React.FC<TransactionMetricsProps> = ({ data, loading = false }) => {
  const chartData = data.history.map((value, index) => ({
    name: index,
    value,
  }));

  return (
    <MetricCard
      title="Transaction Throughput"
      value={`${data.tps.toFixed(1)} TPS`}
      icon={<ArrowUpDown size={24} className="text-red-500" />}
      trend={1.8}
      chart={
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke="#EF4444"
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      }
      tooltipText="Current transactions per second (TPS) with sparkline showing recent TPS trend."
      loading={loading}
    />
  );
};

export default TransactionMetrics;