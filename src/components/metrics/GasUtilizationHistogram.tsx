import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import MetricCard from './MetricCard';
import { supabase } from '../../utils/supabase';
import { SlidersHorizontal } from 'lucide-react'; // Placeholder icon, can be changed

interface GasHistogramDataPoint {
  time: string; // Minute bucket, e.g., "14:35"
  avgUtilization: number; // Percentage
}

interface GasUtilizationHistogramProps {
  subnetId: string | null;
}

const GasUtilizationHistogram: React.FC<GasUtilizationHistogramProps> = ({ subnetId }) => {
  console.log(`[GasUtilizationHistogram] Render. subnetId prop: ${subnetId}`);

  const [histogramData, setHistogramData] = useState<GasHistogramDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log(`[GasUtilizationHistogram useEffect] Triggered. subnetId: ${subnetId}`);

    if (!subnetId) {
      console.log('[GasUtilizationHistogram useEffect] No subnetId, clearing data and stopping.');
      setLoading(false);
      setHistogramData([]);
      setError(null);
      return;
    }

    const fetchData = async () => {
      console.log(`[GasUtilizationHistogram fetchData] Called for subnetId: ${subnetId}. Setting loading true.`);
      setLoading(true);
      setError(null);
      setHistogramData([]);

      try {
        const startTime = new Date('2025-05-23T19:00:00.000Z').toISOString();
        const endTime = new Date('2025-05-23T19:20:00.000Z').toISOString();
        console.log(`[GasUtilizationHistogram fetchData] FIXED Time window: after ${startTime} and before or at ${endTime}`);

        const { data, error: dbError } = await supabase
          .from('gas_utilization_samples')
          .select('block_timestamp, utilization_percentage')
          .eq('subnet_id', subnetId)
          .gte('block_timestamp', startTime)
          .lte('block_timestamp', endTime)
          .order('block_timestamp', { ascending: false });

        console.log('[GasUtilizationHistogram fetchData] Supabase raw response data:', JSON.stringify(data, null, 2));
        console.log('[GasUtilizationHistogram fetchData] Supabase error:', dbError);

        if (dbError) {
          console.error(`[GasUtilizationHistogram fetchData] Supabase error: ${dbError.message}`, dbError);
          setError(dbError.message);
          setHistogramData([]);
        } else if (data && data.length > 0) {
          console.log(`[GasUtilizationHistogram fetchData] ${data.length} samples received from Supabase.`);
          const minuteBuckets: { [key: string]: { totalUtilization: number; count: number } } = {};
          data.forEach(sample => {
            const date = new Date(sample.block_timestamp);
            const minuteKey = `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
            if (!minuteBuckets[minuteKey]) {
              minuteBuckets[minuteKey] = { totalUtilization: 0, count: 0 };
            }
            minuteBuckets[minuteKey].totalUtilization += Number(sample.utilization_percentage) || 0;
            minuteBuckets[minuteKey].count += 1;
          });
          console.log('[GasUtilizationHistogram fetchData] Minute buckets:', JSON.stringify(minuteBuckets, null, 2));

          const processedData = Object.entries(minuteBuckets)
            .map(([time, { totalUtilization, count }]) => ({
              time,
              avgUtilization: count > 0 ? parseFloat((totalUtilization / count).toFixed(2)) : 0,
            }))
            .sort((a, b) => a.time.localeCompare(b.time))

          console.log('[GasUtilizationHistogram fetchData] Final processedData for chart:', JSON.stringify(processedData, null, 2));
          setHistogramData(processedData);
          if (processedData.length === 0) {
             console.log('[GasUtilizationHistogram fetchData] Processed data is empty, though raw data might have existed.');
          }
        } else {
          console.log('[GasUtilizationHistogram fetchData] No data received from Supabase (data is null or empty array) for the fixed window.');
          setHistogramData([]);
        }
      } catch (err: any) {
        console.error('[GasUtilizationHistogram fetchData] Exception during fetch or processing:', err);
        setError(err.message || "An unexpected error occurred.");
        setHistogramData([]);
      } finally {
        console.log('[GasUtilizationHistogram fetchData] Setting loading false.');
        setLoading(false);
      }
    };

    fetchData();
  }, [subnetId]);

  const chart = (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={histogramData} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-muted)" />
        <XAxis dataKey="time" fontSize={10} stroke="var(--text-slate-50, #F8FAFC)" />
        <YAxis unit="%" fontSize={10} stroke="var(--text-slate-50, #F8FAFC)" />
        <RechartsTooltip 
          contentStyle={{ 
            backgroundColor: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)'
          }}
          itemStyle={{ color: 'var(--text-primary)' }}
          labelStyle={{ color: 'var(--text-secondary)' }}
          formatter={(value: number, name: string) => {
            return [`${value}%`, "Avg. Utilization"]; 
          }}
        />
        <Bar dataKey="avgUtilization" fill="var(--text-red-500, #EF4444)" barSize={25} />
      </BarChart>
    </ResponsiveContainer>
  );
  
  const latestAvgUtilization = histogramData.length > 0 ? histogramData[histogramData.length - 1].avgUtilization : null;
  const displayValue = latestAvgUtilization !== null ? `${latestAvgUtilization.toFixed(1)}%` : '-';
  
  console.log(`[GasUtilizationHistogram Render] Loading: ${loading}, Error: ${error}, HistogramData Length: ${histogramData.length}`);

  if (loading) {
      return (
          <MetricCard 
              title="Gas Load (19:00-19:20)"
              icon={<SlidersHorizontal size={24} />}
              loading={true}
          />
      );
  }

  if (error) {
      return (
          <MetricCard 
              title="Gas Load (19:00-19:20)"
              value="Error"
              icon={<SlidersHorizontal size={24} />}
              tooltipText={error}
              loading={false}
          />
      );
  }
  
  if (!subnetId && !loading && !error) { 
      return (
          <MetricCard 
              title="Gas Load (19:00-19:20)"
              value="-"
              icon={<SlidersHorizontal size={24} />}
              tooltipText="Select a subnet to view gas utilization data."
              loading={false}
              chart={<div className="text-center text-sm text-[var(--text-secondary)]">No subnet selected</div>}
          />
      );
  }

  return (
    <MetricCard
      title="Gas Load (19:00-19:20)"
      value={displayValue}
      icon={<SlidersHorizontal size={24} />}
      chart={histogramData.length > 0 ? chart : <div className="text-center text-sm text-[var(--text-secondary)]">{subnetId ? 'No data for 19:00-19:20' : 'Select a subnet'}</div>}
      tooltipText="Average % gas limit used by blocks in each minute (2025-05-23 19:00-19:20 UTC)"
      loading={loading} 
    />
  );
};

export default GasUtilizationHistogram; 