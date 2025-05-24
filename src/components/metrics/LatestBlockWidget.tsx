import React, { useState, useEffect } from 'react';
import MetricCard from './MetricCard';
import { supabase } from '../../utils/supabase';
import { getSupabaseBlockStats, BlockStats } from '../../utils/blockStats';
import { Package } from 'lucide-react';

interface BlockInfo {
  number: number | string;
  timestamp: string;
  transactionCount?: number | string;
  gasUsed?: number | string;
  blockSize?: string;
}

interface LatestBlockWidgetProps {
  subnetId: string | null;
}

const LatestBlockWidget: React.FC<LatestBlockWidgetProps> = ({ subnetId }) => {
  const [blockInfo, setBlockInfo] = useState<BlockInfo | null>(null);
  const [blockStats, setBlockStats] = useState<BlockStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subnetId) {
      console.log('[LatestBlockWidget] No subnetId, clearing data.');
      setLoading(false);
      setBlockInfo(null);
      setBlockStats(null);
      return;
    }

    const fetchData = async () => {
      console.log(`[LatestBlockWidget] Starting fetchData for subnetId: ${subnetId}`);
      setLoading(true);
      setError(null);
      try {
        console.log(`[LatestBlockWidget] Fetching latest block details (timestamp, number, new metrics) for subnetId: ${subnetId}`);
        const { data: latestBlockData, error: latestBlockError } = await supabase
          .from('blocktime_samples')
          .select('block_number, block_timestamp, transaction_count, gas_used, block_size_bytes')
          .eq('subnet_id', subnetId)
          .order('block_timestamp', { ascending: false })
          .limit(1)
          .single();

        console.log('[LatestBlockWidget] Latest block details response:', { latestBlockData, latestBlockError });

        if (latestBlockError) {
          console.error('[LatestBlockWidget] Error fetching latest block details:', latestBlockError);
          throw latestBlockError;
        }

        if (latestBlockData) {
          const newBlockInfo: BlockInfo = {
            number: latestBlockData.block_number,
            timestamp: new Date(latestBlockData.block_timestamp).toLocaleString(),
            transactionCount: latestBlockData.transaction_count !== null ? latestBlockData.transaction_count.toLocaleString() : 'N/A',
            gasUsed: latestBlockData.gas_used !== null ? latestBlockData.gas_used.toLocaleString() : 'N/A',
            blockSize: latestBlockData.block_size_bytes !== null ? `${(latestBlockData.block_size_bytes / 1024).toFixed(2)} KB` : 'N/A',
          };
          setBlockInfo(newBlockInfo);
          console.log('[LatestBlockWidget] Set blockInfo:', newBlockInfo);
        } else {
          setBlockInfo(null);
          console.log('[LatestBlockWidget] No latest block data received, set blockInfo to null.');
        }

        console.log(`[LatestBlockWidget] Fetching block stats using getSupabaseBlockStats for subnetId: ${subnetId}`);
        const stats = await getSupabaseBlockStats(subnetId);
        console.log('[LatestBlockWidget] getSupabaseBlockStats response:', stats);

        if (stats.latestBlockNumber !== null && stats.averageBlockTime !== null) {
          setBlockStats(stats);
          console.log('[LatestBlockWidget] Set blockStats:', stats);
        } else {
          console.warn(`[LatestBlockWidget] Could not retrieve full block stats for subnet ${subnetId}. Stats received:`, stats);
          setBlockStats(null);
        }

      } catch (err: any) {
        console.error(`[LatestBlockWidget] Error in fetchData for subnet ${subnetId}:`, err);
        setError("Failed to load block data.");
        setBlockInfo(null);
        setBlockStats(null);
      } finally {
        setLoading(false);
        console.log(`[LatestBlockWidget] Finished fetchData for subnetId: ${subnetId}`);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 15000);
    return () => clearInterval(intervalId);
  }, [subnetId]);

  const renderContent = () => {
    if (!subnetId && !loading) return <p className="text-sm text-center text-[var(--text-secondary)]">Select a subnet.</p>;
    if (!loading && !error && !blockInfo && !blockStats) return <p className="text-sm text-center text-[var(--text-secondary)]">No data available.</p>;
    if (!loading && error) return null;
    
    const displayBlockNumber = blockStats?.latestBlockNumber ?? blockInfo?.number ?? 'N/A';

    return (
      <div>
        {displayBlockNumber !== 'N/A' && (
          <div className="text-left py-2">
            <span className="font-semibold text-3xl text-[var(--text-primary)]">#{displayBlockNumber.toLocaleString()}</span>
          </div>
        )}
        {displayBlockNumber === 'N/A' && !loading && (
             <div className="text-left py-2">
                <span className="font-semibold text-3xl text-[var(--text-secondary)]"># N/A</span>
            </div>
        )}

        <div className="space-y-1 text-sm pt-2">
          {blockStats?.averageBlockTime !== null && blockStats?.averageBlockTime !== undefined && (
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Avg Block Time (500):</span> <span className="font-mono text-[var(--text-primary)]">{blockStats.averageBlockTime} s</span></div>
          )}
          {blockInfo?.transactionCount !== undefined && (
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Transactions:</span> <span className="font-mono text-[var(--text-primary)]">{blockInfo.transactionCount}</span></div>
          )}
          {blockInfo?.gasUsed !== undefined && (
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Gas Used:</span> <span className="font-mono text-[var(--text-primary)]">{blockInfo.gasUsed}</span></div>
          )}
          {blockInfo?.blockSize !== undefined && (
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Block Size:</span> <span className="font-mono text-[var(--text-primary)]">{blockInfo.blockSize}</span></div>
          )}
          {blockInfo && (
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Timestamp (Latest):</span> <span className="font-mono text-[var(--text-primary)]">{blockInfo.timestamp}</span></div>
          )}
          {(!blockStats?.averageBlockTime && !loading && !error && subnetId && displayBlockNumber !== 'N/A') && (
               <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Avg Block Time (500):</span> <span className="font-mono text-[var(--text-primary)]">N/A</span></div>
          )}
        </div>
      </div>
    );
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
      tooltipText="Details of the latest block and average block time over the last 500 blocks."
      loading={loading}
    />
  );
};

export default LatestBlockWidget;