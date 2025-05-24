import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import MetricCard from './MetricCard';
import { supabase } from '../../utils/supabase';
import { Activity } from 'lucide-react';

interface TpsDataPoint {
  time: string;       // Formatted time for the X-axis/tooltip (e.g., from the last sample in a window)
  tps: number;        // Moving average TPS
  epochTime?: number; // For potential sorting if needed, or identifying the point in time
}

interface LatestTpsSample {
  sampled_at: string;
  tps_value: number;
}

interface TpsWidgetProps {
  subnetId: string | null;
}

const TpsWidget: React.FC<TpsWidgetProps> = ({ subnetId }) => {
  const [currentTps, setCurrentTps] = useState<number | null>(null);
  const [tpsHistory, setTpsHistory] = useState<TpsDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subnetId) {
      setLoading(false);
      setCurrentTps(null);
      setTpsHistory([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch the latest 100 samples for the moving average chart AND overall average
        const { data: latest100Samples, error: historyError } = await supabase
          .from('tps_samples')
          .select('sampled_at, tps_value')
          .eq('subnet_id', subnetId)
          .order('sampled_at', { ascending: false }) // Fetch latest first
          .limit(100);

        if (historyError) {
          if (historyError.code === 'PGRST116') { // No rows found
            console.log('[TpsWidget] No TPS samples found for this subnet.');
            setCurrentTps(null);
            setTpsHistory([]);
          } else {
            throw historyError;
          }
        } else if (latest100Samples && latest100Samples.length > 0) {
          console.log(`[TpsWidget] Fetched ${latest100Samples.length} raw samples.`);

          // Calculate the average of the fetched samples for the main display
          const sumOfTps = latest100Samples.reduce((acc, sample) => acc + sample.tps_value, 0);
          const averageTps = sumOfTps / latest100Samples.length;
          setCurrentTps(averageTps);
          
          // Calculate moving averages for the chart
          const movingAverages: TpsDataPoint[] = [];
          const windowSize = 4;

          // Data is latest first, so iterate normally to calculate moving averages.
          // The resulting movingAverages array will also be latest first.
          for (let i = 0; i <= latest100Samples.length - windowSize; i++) {
            const window = latest100Samples.slice(i, i + windowSize);
            const sum = window.reduce((acc, sample) => acc + sample.tps_value, 0);
            const average = sum / windowSize;
            const lastSampleInWindow = window[0]; // Since data is latest first, window[0] is the latest in this window
            
            movingAverages.push({
              epochTime: new Date(lastSampleInWindow.sampled_at).getTime(),
              time: new Date(lastSampleInWindow.sampled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
              tps: parseFloat(average.toFixed(1)),
            });
          }
          
          const chronologicalMovingAverages = movingAverages.reverse();

          console.log(`[TpsWidget] Processed ${chronologicalMovingAverages.length} moving average data points for the chart.`);
          setTpsHistory(chronologicalMovingAverages.slice(-25));
        } else {
          console.log('[TpsWidget] No historical data fetched.');
          setCurrentTps(null);
          setTpsHistory([]);
        }

      } catch (err: any) {
        console.error(`Error fetching TPS data for subnet ${subnetId}:`, err);
        setError("Failed to load TPS data.");
        setCurrentTps(null);
        setTpsHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 60000);
    return () => clearInterval(intervalId);

  }, [subnetId]);

  const chart = (
    <ResponsiveContainer width="100%" height={60}> 
      <LineChart data={tpsHistory}>
        <XAxis dataKey="time" hide /> 
        <RechartsTooltip 
          contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.25rem' }}
          itemStyle={{ color: 'var(--text-primary)' }}
          labelStyle={{ color: 'var(--text-secondary)' }}
          formatter={(value: number) => [`${value.toFixed(1)} TPS`, null]} 
          labelFormatter={(label: string) => `Time: ${label}`} 
        />
        <Line type="monotone" dataKey="tps" stroke="var(--color-red-500, #EF4444)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
  
  const displayTpsValue = currentTps !== null ? `${currentTps.toFixed(1)} TPS` : '- TPS';

  if (error && !loading && subnetId) {
    return (
        <MetricCard 
            title="Transaction Throughput"
            value="Error"
            icon={<Activity size={24} color="var(--color-red-500, #EF4444)"/>}
            tooltipText={error}
            loading={false}
        />
    );
  }
  
  if (!subnetId && !loading) {
      return (
          <MetricCard 
              title="Transaction Throughput"
              value="- TPS"
              icon={<Activity size={24} />}
              tooltipText="Select a subnet to view TPS data."
              loading={false}
              chart={<div className="text-center text-sm text-[var(--text-secondary)]">No subnet selected</div>}
          />
      );
  }

  return (
    <MetricCard
      title="Transaction Throughput"
      value={displayTpsValue}
      icon={<Activity size={24} color={currentTps === null || currentTps === 0 ? undefined : "var(--color-red-500, #EF4444)"}/>}
      chart={subnetId && tpsHistory.length > 0 ? chart : <div className="text-center text-sm text-[var(--text-secondary)]" style={{height: '60px', display: 'flex', alignItems:'center', justifyContent:'center'}}>{subnetId ? (loading? 'Loading chart...' : 'No historical data') : 'Select a subnet'}</div>}
      tooltipText="Current transactions per second and a sparkline of average TPS per minute over the last hour."
      loading={loading}
    />
  );
};

export default TpsWidget; 