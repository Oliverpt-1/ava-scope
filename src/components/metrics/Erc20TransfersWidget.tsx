import React, { useState, useEffect } from 'react';
import { BarChart, Bar, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import MetricCard from './MetricCard';
import { supabase } from '../../utils/supabase';
import { ArrowRightLeft } from 'lucide-react';

interface TransferDataPoint {
  time: string; // e.g., "HH:00" for hour
  count: number;
}

interface Erc20TransfersWidgetProps {
  subnetId: string | null;
}

const Erc20TransfersWidget: React.FC<Erc20TransfersWidgetProps> = ({ subnetId }) => {
  const [totalTransfers, setTotalTransfers] = useState<number | null>(null);
  const [transferHistory, setTransferHistory] = useState<TransferDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subnetId) {
      setLoading(false);
      setTotalTransfers(0); // Explicitly set to 0 if no subnetId
      setTransferHistory([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data, error: dbError } = await supabase
          .from('erc_transfer_counts')
          .select('block_timestamp, erc20_transfers')
          .eq('subnet_id', subnetId)
          .gte('block_timestamp', twentyFourHoursAgo);
        
        if (dbError) throw dbError;

        let calculatedTotal = 0;
        if (data) {
          calculatedTotal = data.reduce((sum, row) => sum + (row.erc20_transfers || 0), 0);
        }
        setTotalTransfers(calculatedTotal);
        
        const aggregatedHistory: { [key: string]: number } = {}; // Key will be 'YYYY-MM-DDTHH'
        if (data) {
          data.forEach(item => {
            const currentItemCount = Number(item.erc20_transfers) || 0;
            if (currentItemCount > 0) { 
              const date = new Date(item.block_timestamp);
              // Key by UTC hour for 24 data points
              const hourKey = `${date.getUTCHours().toString().padStart(2, '0')}:00`;
              aggregatedHistory[hourKey] = (aggregatedHistory[hourKey] || 0) + currentItemCount;
            }
          });
        }
        
        // Create a full list of the last 24 hours to ensure all slots are present if needed, or just use actual data.
        // For simplicity, we'll just map the aggregated data we have.
        const processedHistory = Object.entries(aggregatedHistory)
            .map(([time, count]) => ({ time, count }))
            // Sort by time to ensure the chart displays chronologically if hours are not sequential from aggregation
            .sort((a,b) => a.time.localeCompare(b.time)); 
            // .slice(-24); // Might not be needed if keys are unique for 24h

        setTransferHistory(processedHistory);

      } catch (err: any) {
        console.error(`Error fetching ERC20 transfer data for subnet ${subnetId}:`, err);
        setError("Failed to load ERC20 transfer data.");
        setTotalTransfers(0); // Set to 0 on error
        setTransferHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 5 * 60000); 
    return () => clearInterval(intervalId);
  }, [subnetId]);

  const chart = (
    // Increased height for better visibility of hourly data
    <ResponsiveContainer width="100%" height={100}> 
      <BarChart data={transferHistory}>
        <RechartsTooltip 
          contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
          cursor={{ fill: 'var(--bg-primary)' }}
        />
        {/* Optionally, show XAxis with formatted hour if desired, or keep hidden */}
        <XAxis dataKey="time" fontSize={10} stroke="var(--text-slate-50, #F8FAFC)" interval="preserveStartEnd" tickFormatter={(tick) => tick.substring(0,2)} />
        <YAxis fontSize={10} stroke="var(--text-slate-50, #F8FAFC)" allowDecimals={false} />
        {/* Changed fill to red */}
        <Bar dataKey="count" fill="var(--text-red-500, #EF4444)" barSize={15} /> 
      </BarChart>
    </ResponsiveContainer>
  );

  // Display 0 if totalTransfers is 0 or null (after loading and no error)
  const displayValue = totalTransfers !== null ? totalTransfers.toLocaleString() : '0';
  
  if (error && !loading && subnetId) {
    return (
        <MetricCard 
            title="ERC20 Transfers (24h)"
            value="Error"
            icon={<ArrowRightLeft size={24} />}
            tooltipText={error}
            loading={false}
        />
    );
  }
  
  // If no subnet selected, show 0 explicitly
  if (!subnetId && !loading) {
      return (
          <MetricCard 
              title="ERC20 Transfers (24h)"
              value="0"
              icon={<ArrowRightLeft size={24} />}
              tooltipText="Select a subnet to view ERC20 transfer data."
              loading={false}
              chart={<div className="text-center text-sm text-[var(--text-secondary)]">No subnet selected</div>}
          />
      );
  }

  return (
    <MetricCard
      title="ERC20 Transfers (24h)"
      value={displayValue}
      icon={<ArrowRightLeft size={24} />}
      chart={subnetId && transferHistory.length > 0 ? chart : <div className="h-[100px] flex items-center justify-center text-center text-sm text-[var(--text-secondary)]">{ (loading && subnetId) ? 'Loading chart...' : 'No transfer data in the last 24h'}</div>}
      tooltipText="Total ERC20 token transfers in the past 24 hours, with a bar chart of transfers per hour."
      loading={loading}
    />
  );

};

export default Erc20TransfersWidget; 