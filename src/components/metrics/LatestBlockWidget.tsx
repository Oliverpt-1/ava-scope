import React, { useState, useEffect } from 'react';
import MetricCard from './MetricCard';
import { supabase } from '../../utils/supabase';
import { Package } from 'lucide-react';

interface BlockInfo {
  number: number | string;
  size: number | string;
  gasUsed: number | string;
  timestamp: string;
}

interface LatestBlockWidgetProps {
  subnetId: string | null;
}

const LatestBlockWidget: React.FC<LatestBlockWidgetProps> = ({ subnetId }) => {
  const [blockInfo, setBlockInfo] = useState<BlockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subnetId) {
      setLoading(false);
      setBlockInfo(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from('blocktime_samples')
          .select('block_number, block_size_bytes, gas_used, block_timestamp')
          .eq('subnet_id', subnetId)
          .order('block_timestamp', { ascending: false })
          .limit(1)
          .single();

        if (dbError) throw dbError;

        if (data) {
          setBlockInfo({
            number: data.block_number,
            size: data.block_size_bytes ? `${(data.block_size_bytes / 1024).toFixed(2)} KB` : 'N/A',
            gasUsed: data.gas_used ? data.gas_used.toLocaleString() : 'N/A',
            timestamp: new Date(data.block_timestamp).toLocaleString(),
          });
        } else {
          setBlockInfo(null);
        }
      } catch (err: any) {
        console.error(`Error fetching latest block data for subnet ${subnetId}:`, err);
        setError("Failed to load latest block data.");
        setBlockInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 15000);
    return () => clearInterval(intervalId);
  }, [subnetId]);

  const renderContent = () => {
    if (!subnetId && !loading) return <p className="text-sm text-center text-[var(--text-secondary)]">Select a subnet.</p>;
    if (!blockInfo && !error) return <p className="text-sm text-center text-[var(--text-secondary)]">No data available.</p>;
    if (!blockInfo && error) return null; // Error is handled by the main error return
    if (blockInfo) {
        return (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Block #:</span> <span className="font-mono text-[var(--text-primary)]">{blockInfo.number}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Size:</span> <span className="font-mono text-[var(--text-primary)]">{blockInfo.size}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Gas Used:</span> <span className="font-mono text-[var(--text-primary)]">{blockInfo.gasUsed}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Timestamp:</span> <span className="font-mono text-[var(--text-primary)]">{blockInfo.timestamp}</span></div>
          </div>
        );
    }
    return null;
  };
  
  if (error && !loading && subnetId) {
    return (
        <MetricCard 
            title="Latest Block Info"
            icon={<Package size={24} />}
            tooltipText={error}
            loading={false}
            chart={<div className="text-center text-sm text-red-500">Error loading data</div>}
        />
    );
  }

  return (
    <MetricCard
      title="Latest Block Info"
      icon={<Package size={24} />}
      chart={renderContent()} 
      tooltipText="Details of the latest processed block on the subnet."
      loading={loading}
    />
  );
};

export default LatestBlockWidget; 