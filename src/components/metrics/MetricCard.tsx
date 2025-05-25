import React, { useState } from 'react';
import { MetricCardProps } from '../../types';
import { Info, RefreshCw } from 'lucide-react';

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  trend,
  chart,
  tooltipText,
  loading = false,
  onRefresh,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg p-5 shadow-md transition-all duration-300 hover:shadow-lg border border-[var(--border-color)] h-full">
      {loading ? (
        <div className="animate-pulse">
          <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-[var(--bg-primary)] rounded w-24"></div>
            <div className="w-8 h-8 rounded-full bg-[var(--bg-primary)]"></div>
          </div>
          <div className="h-10 bg-[var(--bg-primary)] rounded mb-4"></div>
          <div className="h-24 bg-[var(--bg-primary)] rounded"></div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[var(--text-secondary)] font-medium flex items-center">
              {title}
              {tooltipText && (
                <div className="relative ml-2">
                  <button
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <Info size={16} />
                  </button>
                  {showTooltip && (
                    <div className="absolute z-10 w-64 p-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm rounded-md shadow-lg -left-20 mt-2 border border-[var(--border-color)]">
                      {tooltipText}
                    </div>
                  )}
                </div>
              )}
            </h3>
            <div className="flex items-center">
              {onRefresh && (
                <button 
                  onClick={onRefresh}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mr-2 p-1 rounded-full hover:bg-[var(--bg-primary)]"
                  aria-label="Refresh data"
                >
                  <RefreshCw size={16} />
                </button>
              )}
              <div className="text-red-500">{icon}</div>
            </div>
          </div>
          
          <div className="flex items-baseline mb-4">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{value}</h2>
            {trend !== undefined && (
              <span 
                className={`ml-2 text-sm font-medium ${
                  trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-[var(--text-secondary)]'
                }`}
              >
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            )}
          </div>
          
          {chart && <div className="mt-4">{chart}</div>}
        </>
      )}
    </div>
  );
};

export default MetricCard;