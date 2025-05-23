import React, { useState, useEffect } from 'react';
import { BarChart, Bar, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import MetricCard from './MetricCard';
import { supabase } from '../../utils/supabase';
import { ImageIcon } from 'lucide-react'; // Placeholder icon for NFTs

interface TransferDataPoint {
  time: string; // e.g., "HH:MM"
  count: number;
}

interface Erc721TransfersWidgetProps {
  subnetId: string | null;
}

const Erc721TransfersWidget: React.FC<Erc721TransfersWidgetProps> = ({ subnetId }) => {
  const [totalTransfers, setTotalTransfers] = useState<number | null>(null);
  const [transferHistory, setTransferHistory] = useState<TransferDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subnetId) {
      setLoading(false);
      setTotalTransfers(null);
      setTransferHistory([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Fetch total ERC721 transfers
        const { data: totalData, error: totalError } = await supabase
          .from('erc_transfer_counts')
          .select('count') // Assuming 'count' column holds the number of transfers for that record
          .eq('subnet_id', subnetId)
          .eq('type', 'ERC721')
          .gte('timestamp', twentyFourHoursAgo);

        if (totalError) throw totalError;
        const calculatedTotal = totalData?.reduce((acc, curr) => acc + curr.count, 0) ?? 0;
        setTotalTransfers(calculatedTotal);

        // Fetch ERC721 transfer history
        const { data: historyData, error: historyError } = await supabase
          .from('erc_transfer_counts')
          .select('timestamp, count')
          .eq('subnet_id', subnetId)
          .eq('type', 'ERC721')
          .gte('timestamp', twentyFourHoursAgo)
          .order('timestamp', { ascending: true });

        if (historyError) throw historyError;
        
        const aggregatedHistory: { [key: string]: number } = {};
        (historyData || []).forEach(item => {
          const hour = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          aggregatedHistory[hour] = (aggregatedHistory[hour] || 0) + item.count;
        });
        
        const processedHistory = Object.entries(aggregatedHistory)
            .map(([time, count]) => ({ time, count }))
            .slice(-24);

        setTransferHistory(processedHistory);

      } catch (err: any) {
        console.error(`Error fetching ERC721 transfer data for subnet ${subnetId}:`, err);
        setError("Failed to load ERC721 transfer data.");
        setTotalTransfers(null);
        setTransferHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 5 * 60000); // Refresh every 5 minutes
    return () => clearInterval(intervalId);
  }, [subnetId]);

  const chart = (
    <ResponsiveContainer width="100%" height={60}>
      <BarChart data={transferHistory}>
        <RechartsTooltip 
          contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
          cursor={{ fill: 'var(--bg-primary)' }}
        />
        <XAxis dataKey="time" hide />
        <Bar dataKey="count" fill="var(--text-green-500)" /> 
      </BarChart>
    </ResponsiveContainer>
  );

  const displayValue = totalTransfers !== null ? totalTransfers.toLocaleString() : '-';
  
  if (error && !loading && subnetId) {
    return (
        <MetricCard 
            title="ERC721 Transfers (24h)"
            value="Error"
            icon={<ImageIcon size={24} />}
            tooltipText={error}
            loading={false}
        />
    );
  }
  
  if (!subnetId && !loading) {
    return (
        <MetricCard 
            title="ERC721 Transfers (24h)"
            value="-"
            icon={<ImageIcon size={24} />}
            tooltipText="Select a subnet to view ERC721 transfer data."
            loading={false}
            chart={<div className="text-center text-sm text-[var(--text-secondary)]">No subnet selected</div>}
        />
    );
  }

  return (
    <MetricCard
      title="ERC721 Transfers (24h)"
      value={displayValue}
      icon={<ImageIcon size={24} />}
      chart={subnetId && transferHistory.length > 0 ? chart : <div className="text-center text-sm text-[var(--text-secondary)]">{subnetId ? 'No historical data' : 'Select a subnet' }</div>}
      tooltipText="Total ERC721 (NFT) transfers in the past 24 hours, with a bar chart of transfers per period."
      loading={loading}
    />
  );
};

export default Erc721TransfersWidget; 