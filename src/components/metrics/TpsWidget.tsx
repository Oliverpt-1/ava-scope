import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import MetricCard from './MetricCard';
import { supabase } from '../../utils/supabase';
import { Activity } from 'lucide-react';

interface TpsDataPoint {
  time: string;
  tps: number;
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
      // setError("No subnet selected"); // Optional: set error if no subnet ID
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: currentData, error: currentError } = await supabase
          .from('tps_samples')
          .select('value')
          .eq('subnet_id', subnetId)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (currentError) throw currentError;
        setCurrentTps(currentData?.value ?? null);

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: historyData, error: historyError } = await supabase
          .from('tps_samples')
          .select('timestamp, value')
          .eq('subnet_id', subnetId)
          .gte('timestamp', twentyFourHoursAgo)
          .order('timestamp', { ascending: true });

        if (historyError) throw historyError;
        
        const processedHistory = (historyData || []).map(item => ({
          time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tps: item.value,
        })).slice(-60);

        setTpsHistory(processedHistory);

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
        <RechartsTooltip 
          contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
        />
        <Line type="monotone" dataKey="tps" stroke="var(--text-red-500)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
  
  const displayValue = currentTps !== null ? currentTps.toFixed(2) : '-';

  if (error && !loading && subnetId) { // Only show error if subnetId was provided but fetch failed
    return (
        <MetricCard 
            title="TPS (Transactions Per Second)"
            value="Error"
            icon={<Activity size={24} />}
            tooltipText={error}
            loading={false} // Explicitly false as it's an error state after loading attempt
        />
    );
  }
  
  // Show appropriate message if no subnet ID is provided and not loading
  if (!subnetId && !loading) {
      return (
          <MetricCard 
              title="TPS (Transactions Per Second)"
              value="-"
              icon={<Activity size={24} />}
              tooltipText="Select a subnet to view TPS data."
              loading={false}
              chart={<div className="text-center text-sm text-[var(--text-secondary)]">No subnet selected</div>}
          />
      );
  }

  return (
    <MetricCard
      title="TPS (Transactions Per Second)"
      value={displayValue}
      icon={<Activity size={24} />}
      chart={subnetId && tpsHistory.length > 0 ? chart : <div className="text-center text-sm text-[var(--text-secondary)]">{subnetId ? 'No historical data' : 'Select a subnet'}</div>}
      tooltipText="Current transactions per second and a sparkline of average TPS per minute over the last 24 hours."
      loading={loading}
    />
  );
};

export default TpsWidget; 