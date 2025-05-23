import React from 'react';
import { Database } from 'lucide-react';
import MetricCard from './MetricCard';
import { MempoolData } from '../../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface MempoolActivityProps {
  data: MempoolData;
  loading?: boolean;
}

const MempoolActivity: React.FC<MempoolActivityProps> = ({ data, loading = false }) => {
  const chartData = data.history.map((value, index) => ({
    name: index,
    value,
  }));

  return (
    <MetricCard
      title="Mempool Activity"
      value={data.size}
      icon={<Database size={24} className="text-red-500" />}
      trend={3.2}
      chart={
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorMempool" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1E293B',
                borderColor: '#334155',
                borderRadius: '0.375rem',
                color: '#F8FAFC'
              }} 
              formatter={(value: number) => [`${value} tx`, 'Transactions']}
              labelFormatter={(label) => `Block ${label}`}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#EF4444" 
              fillOpacity={1} 
              fill="url(#colorMempool)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      }
      tooltipText="Number of transactions waiting to be processed in the mempool. Chart shows activity over the last 10 blocks."
      loading={loading}
    />
  );
};

export default MempoolActivity;