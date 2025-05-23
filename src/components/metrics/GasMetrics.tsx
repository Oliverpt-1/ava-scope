import React from 'react';
import { Fuel } from 'lucide-react';
import MetricCard from './MetricCard';
import { GasData } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface GasMetricsProps {
  data: GasData;
  loading?: boolean;
}

const GasMetrics: React.FC<GasMetricsProps> = ({ data, loading = false }) => {
  const chartData = data.history.map((value, index) => ({
    name: `Block ${index + 1}`,
    value,
  }));

  return (
    <MetricCard
      title="Gas Usage"
      value={`${data.average.toFixed(1)} gwei`}
      icon={<Fuel size={24} className="text-red-500" />}
      chart={
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
            <XAxis dataKey="name" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ 
                backgroundColor: '#1E293B',
                borderColor: '#334155',
                borderRadius: '0.375rem',
                color: '#F8FAFC'
              }} 
              formatter={(value: number) => [`${value.toFixed(1)} gwei`, 'Gas Price']}
            />
            <Bar dataKey="value" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      }
      tooltipText="Average gas price in gwei for the last block. Bar chart shows gas price trends over recent blocks."
      loading={loading}
    />
  );
};

export default GasMetrics;