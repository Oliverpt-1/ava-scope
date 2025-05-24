import React, { useState, useEffect } from 'react';
import { BarChart, Bar, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import MetricCard from './MetricCard';
import { supabase } from '../../utils/supabase';
import { ArrowRightLeft } from 'lucide-react';

interface TransferDataPoint {
  time: string; // e.g., "HH:00" for hour, or just "HH" for display
  count: number;
  fullTime?: string; // For sorting if needed, e.g. ISO-like string for the hour
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
      setTotalTransfers(0);
      setTransferHistory([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const { data, error: dbError } = await supabase
          .from('erc_transfer_counts')
          .select('block_timestamp, erc20_transfers')
          .eq('subnet_id', subnetId)
          .gte('block_timestamp', twentyFourHoursAgo.toISOString());
        
        if (dbError) throw dbError;

        let calculatedTotal = 0;
        if (data) {
          calculatedTotal = data.reduce((sum, row) => sum + (row.erc20_transfers || 0), 0);
        }
        setTotalTransfers(calculatedTotal);
        
        // Initialize 24 hourly slots for the last 24 hours
        const hourlySlots: { [key: string]: TransferDataPoint } = {};
        for (let i = 0; i < 24; i++) {
          const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000);
          const hourKey = `${hourDate.getUTCHours().toString().padStart(2, '0')}`;
          // Use a sortable key for initial object construction if order matters before Object.entries
          // For display, we'll format 'time' later. Store epoch for sorting.
          hourlySlots[hourKey] = { 
            time: hourKey, // Will be used as label, e.g., "10"
            count: 0,
            fullTime: `${hourDate.getUTCFullYear()}-${(hourDate.getUTCMonth()+1).toString().padStart(2, '0')}-${hourDate.getUTCDate().toString().padStart(2, '0')}T${hourKey}:00:00Z`
          };
        }

        if (data) {
          data.forEach(item => {
            const currentItemCount = Number(item.erc20_transfers) || 0;
            if (currentItemCount > 0) { 
              const date = new Date(item.block_timestamp);
              const hourKey = `${date.getUTCHours().toString().padStart(2, '0')}`;
              if (hourlySlots[hourKey]) {
                hourlySlots[hourKey].count += currentItemCount;
              }
            }
          });
        }
        
        const processedHistory = Object.values(hourlySlots)
            .sort((a,b) => new Date(a.fullTime!).getTime() - new Date(b.fullTime!).getTime()); 

        setTransferHistory(processedHistory);

      } catch (err: any) {
        console.error(`Error fetching ERC20 transfer data for subnet ${subnetId}:`, err);
        setError("Failed to load ERC20 transfer data.");
        setTotalTransfers(0);
        setTransferHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 5 * 60 * 1000); 
    return () => clearInterval(intervalId);
  }, [subnetId]);

  const chart = (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={transferHistory} barGap={1} barCategoryGap="10%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color-secondary, #374151)"/>
        <RechartsTooltip 
          contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.25rem'}}
          itemStyle={{ color: 'var(--text-primary)' }}
          labelStyle={{ color: 'var(--text-secondary)'}}
          cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }}
          labelFormatter={(label) => `${label}:00 UTC`}
          formatter={(value: number) => [value.toLocaleString(), 'Transfers']}
        />
        <XAxis 
          dataKey="time" 
          fontSize={10} 
          stroke="var(--text-slate-400, #94A3B8)"
          axisLine={{stroke: 'var(--border-color-secondary, #374151)'}}
          tickLine={{stroke: 'var(--text-slate-400, #94A3B8)'}}
          interval={0}
        />
        <YAxis 
          fontSize={10} 
          stroke="var(--text-slate-400, #94A3B8)" 
          axisLine={{stroke: 'var(--border-color-secondary, #374151)'}}
          tickLine={{stroke: 'var(--text-slate-400, #94A3B8)'}}
          allowDecimals={false} 
          tickCount={4}
          width={35}
        />
        <Bar dataKey="count" fill="var(--color-red-500, #EF4444)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const displayValue = totalTransfers !== null ? totalTransfers.toLocaleString() : '0';
  
  if (error && !loading && subnetId) {
    return (
        <MetricCard 
            title="ERC20 Transfers (24h)"
            value="Error"
            icon={<ArrowRightLeft size={24} color="var(--color-red-500, #EF4444)"/>}
            tooltipText={error}
            loading={false}
        />
    );
  }
  
  if (!subnetId && !loading) {
      return (
          <MetricCard 
              title="ERC20 Transfers (24h)"
              value="0"
              icon={<ArrowRightLeft size={24} />}
              tooltipText="Select a subnet to view ERC20 transfer data."
              loading={false}
              chart={<div className="h-[150px] flex items-center justify-center text-center text-sm text-[var(--text-secondary)]">No subnet selected</div>}
          />
      );
  }

  return (
    <MetricCard
      title="ERC20 Transfers (24h)"
      value={displayValue}
      icon={<ArrowRightLeft size={24} color={totalTransfers && totalTransfers > 0 ? "var(--color-red-500, #EF4444)" : undefined}/>}
      chart={subnetId && transferHistory.length > 0 ? chart : <div className="h-[150px] flex items-center justify-center text-center text-sm text-[var(--text-secondary)]">{ (loading && subnetId) ? 'Loading chart...' : 'No transfer data in the last 24h'}</div>}
      tooltipText="Total ERC20 token transfers in the past 24 hours, with a bar chart of transfers per hour."
      loading={loading}
    />
  );

};

export default Erc20TransfersWidget; 