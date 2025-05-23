import React from 'react';
import { Code2 } from 'lucide-react';
import MetricCard from './MetricCard';
import { ContractData } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ContractActivityProps {
  data: ContractData;
  loading?: boolean;
}

const ContractActivity: React.FC<ContractActivityProps> = ({ data, loading = false }) => {
  const chartData = [
    { name: 'Read Calls', value: data.read },
    { name: 'Write Calls', value: data.write },
  ];

  const COLORS = ['#EF4444', '#F87171'];

  const total = data.read + data.write;
  const readPercentage = ((data.read / total) * 100).toFixed(1);
  const writePercentage = ((data.write / total) * 100).toFixed(1);

  return (
    <MetricCard
      title="Contract Activity"
      value={`${total.toLocaleString()} calls`}
      icon={<Code2 size={24} className="text-red-500" />}
      chart={
        <div className="flex items-center justify-between">
          <ResponsiveContainer width="60%" height={100}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={40}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ 
                  backgroundColor: '#1E293B',
                  borderColor: '#334155',
                  borderRadius: '0.375rem',
                  color: '#F8FAFC'
                }}
                formatter={(value: number) => [`${value.toLocaleString()}`, 'Calls']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-sm">
            <div className="flex items-center mb-2">
              <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
              <span className="text-slate-300">Read: {readPercentage}%</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-red-400 mr-2"></span>
              <span className="text-slate-300">Write: {writePercentage}%</span>
            </div>
          </div>
        </div>
      }
      tooltipText="Distribution of smart contract read vs write calls. Shows the balance between query operations and state-changing transactions."
      loading={loading}
    />
  );
};

export default ContractActivity;