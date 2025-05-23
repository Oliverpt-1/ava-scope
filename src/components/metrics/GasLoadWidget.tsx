import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import MetricCard from './MetricCard';
import { supabase } from '../../utils/supabase';
import { SlidersHorizontal } from 'lucide-react';

interface GasDataPoint {
  time: string;
  avgGasUtilization: number;
}

interface GasLoadWidgetProps {
  subnetId: string | null;
}

const GasLoadWidget: React.FC<GasLoadWidgetProps> = ({ subnetId }) => {
  const [gasLoadData, setGasLoadData] = useState<GasDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subnetId) {
      setLoading(false);
      setGasLoadData([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

        const { data, error: dbError } = await supabase
          .from('gas_utilization_samples')
          .select('timestamp, value')
          .eq('subnet_id', subnetId)
          .gte('timestamp', fifteenMinutesAgo)
          .order('timestamp', { ascending: false });

        if (dbError) throw dbError;

        const minuteBuckets: { [key: string]: { totalUtilization: number; count: number } } = {};
        (data || []).forEach(sample => {
          const date = new Date(sample.timestamp);
          const minuteKey = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          if (!minuteBuckets[minuteKey]) {
            minuteBuckets[minuteKey] = { totalUtilization: 0, count: 0 };
          }
          minuteBuckets[minuteKey].totalUtilization += sample.value;
          minuteBuckets[minuteKey].count += 1;
        });

        const processedData = Object.entries(minuteBuckets)
          .map(([time, { totalUtilization, count }]) => ({
            time,
            avgGasUtilization: count > 0 ? parseFloat((totalUtilization / count).toFixed(2)) : 0,
          }))
          .sort((a, b) => a.time.localeCompare(b.time))
          .slice(-15);

        setGasLoadData(processedData);

      } catch (err: any) {
        console.error(`Error fetching gas load data for subnet ${subnetId}:`, err);
        setError("Failed to load gas load data.");
        setGasLoadData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 60000);
    return () => clearInterval(intervalId);
  }, [subnetId]);

  const chart = (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={gasLoadData} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-muted)" />
        <XAxis dataKey="time" fontSize={10} stroke="var(--text-secondary)" />
        <YAxis unit="%" fontSize={10} stroke="var(--text-secondary)" />
        <RechartsTooltip 
          contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
          labelStyle={{ color: 'var(--text-secondary)' }}
          formatter={(value: number) => [`${value}%`, 'Avg Utilization']}
        />
        <Bar dataKey="avgGasUtilization" fill="var(--text-purple-500)" barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
  
  const latestGasUtilization = gasLoadData.length > 0 ? gasLoadData[gasLoadData.length -1].avgGasUtilization : null;
  const displayValue = latestGasUtilization !== null ? `${latestGasUtilization.toFixed(1)}%` : '-';

  if (error && !loading && subnetId) {
    return (
        <MetricCard 
            title="Gas Load (Last 15 Min)"
            value="Error"
            icon={<SlidersHorizontal size={24} />}
            tooltipText={error}
            loading={false}
        />
    );
  }
  
  if (!subnetId && !loading) {
    return (
        <MetricCard 
            title="Gas Load (Last 15 Min)"
            value="-"
            icon={<SlidersHorizontal size={24} />}
            tooltipText="Select a subnet to view gas load data."
            loading={false}
            chart={<div className="text-center text-sm text-[var(--text-secondary)]">No subnet selected</div>}
        />
    );
  }

  return (
    <MetricCard
      title="Gas Load (Last 15 Min)"
      value={displayValue}
      icon={<SlidersHorizontal size={24} />}
      chart={subnetId && gasLoadData.length > 0 ? chart : <div className="text-center text-sm text-[var(--text-secondary)]">{subnetId ? 'No data for last 15 min' : 'Select a subnet'}</div>}
      tooltipText="Histogram of average gas utilization (% of block gas limit used) per minute, for the last 15 minutes."
      loading={loading}
    />
  );
};

export default GasLoadWidget; 