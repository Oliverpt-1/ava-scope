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
  const [histogramData, setHistogramData] = useState<GasHistogramDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subnetId) {
      setLoading(false);
      setHistogramData([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

        const { data, error: dbError } = await supabase
          .from('gas_utilization_samples')
          .select('block_timestamp, utilization_percentage') // Changed to utilization_percentage
          .eq('subnet_id', subnetId)
          .gte('block_timestamp', fifteenMinutesAgo) // Ensure we filter by block_timestamp
          .order('block_timestamp', { ascending: false });

        if (dbError) throw dbError;

        const minuteBuckets: { [key: string]: { totalUtilization: number; count: number } } = {};
        (data || []).forEach(sample => {
          const date = new Date(sample.block_timestamp);
          const minuteKey = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          if (!minuteBuckets[minuteKey]) {
            minuteBuckets[minuteKey] = { totalUtilization: 0, count: 0 };
          }
          // Use utilization_percentage, ensuring it's a number (it's float in DB)
          minuteBuckets[minuteKey].totalUtilization += Number(sample.utilization_percentage) || 0;
          minuteBuckets[minuteKey].count += 1;
        });

        const processedData = Object.entries(minuteBuckets)
          .map(([time, { totalUtilization, count }]) => ({
            time,
            // Multiply by 100 if utilization_percentage is 0.0-1.0 and you want to display 0-100%
            // Assuming utilization_percentage is already 0-100 if it's for display
            avgUtilization: count > 0 ? parseFloat((totalUtilization / count).toFixed(2)) : 0,
          }))
          .sort((a, b) => a.time.localeCompare(b.time)) // Sort by time ascending for chart
          .slice(-15); // Ensure we only show up to 15 minutes of data

        setHistogramData(processedData);

      } catch (err: any) {
        console.error(`Error fetching gas utilization data for subnet ${subnetId}:`, err);
        setError("Failed to load gas utilization data.");
        setHistogramData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(intervalId);
  }, [subnetId]);

  const chart = (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={histogramData} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-muted)" />
        {/* Assuming var(--text-slate-50) is defined in your CSS. Otherwise, use a direct hex color e.g. "#F8FAFC" */}
        <XAxis dataKey="time" fontSize={10} stroke="var(--text-slate-50, #F8FAFC)" />
        <YAxis unit="%" fontSize={10} stroke="var(--text-slate-50, #F8FAFC)" />
        <RechartsTooltip 
          contentStyle={{ 
            backgroundColor: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)' // Text color for tooltip content
          }}
          itemStyle={{ color: 'var(--text-primary)' }} // Color for items in tooltip
          labelStyle={{ color: 'var(--text-secondary)' }} // Color for label (time) in tooltip
          formatter={(value: number, name: string) => {
            // If 'name' is 'avgUtilization', format it.
            // The default name is the dataKey, "avgUtilization"
            return [`${value}%`, "Avg. Utilization"]; 
          }}
        />
        {/* Assuming var(--text-blue-500) exists. Otherwise, use a direct hex or Tailwind fill class if Recharts supports it. */}
        <Bar dataKey="avgUtilization" fill="var(--text-blue-500, #3B82F6)" barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
  
  const latestAvgUtilization = histogramData.length > 0 ? histogramData[histogramData.length -1].avgUtilization : null;
  // Displaying the average utilization of the most recent bucket
  const displayValue = latestAvgUtilization !== null ? `${latestAvgUtilization.toFixed(1)}%` : '-';

  if (error && !loading && subnetId) {
    return (
        <MetricCard 
            title="Gas Load (Last 15 Min)"
            value="Error"
            icon={<SlidersHorizontal size={24} />} // Same icon for now
            tooltipText={error} // Show specific error message
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
            tooltipText="Select a subnet to view gas utilization data."
            loading={false}
            chart={<div className="text-center text-sm text-[var(--text-secondary)]">No subnet selected</div>}
        />
    );
  }

  return (
    <MetricCard
      title="Gas Load (Last 15 Min)"
      value={displayValue} // Shows the most recent minute's average utilization
      icon={<SlidersHorizontal size={24} />}
      chart={subnetId && histogramData.length > 0 ? chart : <div className="text-center text-sm text-[var(--text-secondary)]">{subnetId ? 'No data for last 15 min' : 'Select a subnet'}</div>}
      tooltipText="Average % gas limit used by blocks in each minute" // Updated tooltip text
      loading={loading}
    />
  );
};

export default GasUtilizationHistogram; 