import React from 'react';
import { Boxes } from 'lucide-react';
import MetricCard from './MetricCard';
// import { BlockData } from '../../types'; // No longer using full BlockData array directly for all fields

interface BlockProductionProps {
  latestBlock: number | null;
  avgBlockTime: number | null;
  transactions: number | null; 
  size: number | null;         
  loading?: boolean;
  // If you want to show recent blocks, you'd pass blocktimeSamples here
  // For example: recentBlocks?: { block_number: number; transactions_count?: number }[]; 
}

const BlockProduction: React.FC<BlockProductionProps> = ({ 
  latestBlock, 
  avgBlockTime,
  transactions, 
  size,         
  loading = false,
  // recentBlocks = [] // Example if passing recent blocks data
}) => {
  
  const displayLatestBlock = latestBlock !== null ? `#${latestBlock.toLocaleString()}` : 'N/A';
  const displayAvgBlockTime = avgBlockTime !== null ? `${avgBlockTime.toFixed(2)} sec` : 'N/A';
  const displayTransactions = transactions !== null ? transactions.toString() : 'N/A';
  const displaySize = size !== null ? `${size} bytes` : 'N/A';

  return (
    <MetricCard
      title="Block Production"
      value={displayLatestBlock}
      icon={<Boxes size={24} className="text-red-500" />}
      chart={
        <div className="mt-2">
          <div className="flex justify-between text-sm text-slate-400 mb-1">
            <span>Avg Block Time:</span>
            <span className="font-medium text-slate-200">{displayAvgBlockTime}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-400 mb-1">
            <span>Transactions (Latest):</span>
            <span className="font-medium text-slate-200">{displayTransactions}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-400">
            <span>Size (Latest):</span>
            <span className="font-medium text-slate-200">{displaySize}</span>
          </div>
          
          {/* 
          Recent Blocks display example (if recentBlocks prop is implemented):
          {recentBlocks && recentBlocks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="text-xs text-slate-400">Recent Blocks</div>
              <div className="grid grid-cols-5 gap-1 mt-1">
                {recentBlocks.slice(0, 5).map((block) => (
                  <div 
                    key={block.block_number} 
                    className="bg-slate-700 rounded-sm p-1 text-center"
                    title={`Block #${block.block_number}${block.transactions_count ? ': '+block.transactions_count+' txs' : ''}`}
                  >
                    <div className="text-xs text-slate-300">#{block.block_number.toString().slice(-3)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          */}
        </div>
      }
      tooltipText="Latest block height and average time between blocks. Transaction and size data are for the latest block (if available)."
      loading={loading}
    />
  );
};

export default BlockProduction;