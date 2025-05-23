import React from 'react';
import { Boxes } from 'lucide-react';
import MetricCard from './MetricCard';
import { BlockData } from '../../types';

interface BlockProductionProps {
  data: BlockData[];
  loading?: boolean;
}

const BlockProduction: React.FC<BlockProductionProps> = ({ data, loading = false }) => {
  const latestBlock = data[0];
  
  const calculateTimeBetweenBlocks = () => {
    if (data.length < 2) return 'N/A';
    
    let totalTime = 0;
    for (let i = 0; i < data.length - 1; i++) {
      totalTime += data[i].timestamp - data[i + 1].timestamp;
    }
    
    const avgTimeMs = totalTime / (data.length - 1);
    const avgTimeSec = avgTimeMs / 1000;
    
    return `${avgTimeSec.toFixed(2)} sec`;
  };

  return (
    <MetricCard
      title="Block Production"
      value={`#${latestBlock.height.toLocaleString()}`}
      icon={<Boxes size={24} className="text-red-500" />}
      chart={
        <div className="mt-2">
          <div className="flex justify-between text-sm text-slate-400 mb-1">
            <span>Avg Block Time:</span>
            <span className="font-medium text-slate-200">{calculateTimeBetweenBlocks()}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-400 mb-1">
            <span>Transactions:</span>
            <span className="font-medium text-slate-200">{latestBlock.transactions}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-400">
            <span>Size:</span>
            <span className="font-medium text-slate-200">{latestBlock.size} bytes</span>
          </div>
          
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="text-xs text-slate-400">Recent Blocks</div>
            <div className="grid grid-cols-5 gap-1 mt-1">
              {data.map((block, index) => (
                <div 
                  key={block.height} 
                  className="bg-slate-700 rounded-sm p-1 text-center"
                  title={`Block #${block.height}: ${block.transactions} txs`}
                >
                  <div className="text-xs text-slate-300">#{block.height.toString().slice(-3)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
      tooltipText="Latest block height and statistics including average time between blocks, transactions per block, and block size."
      loading={loading}
    />
  );
};

export default BlockProduction;