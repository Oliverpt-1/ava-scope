import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';
import MetricCard from './MetricCard';
import { ValidatorData } from '../../types';

interface ValidatorHealthProps {
  data: ValidatorData;
  loading?: boolean;
}

const ValidatorHealth: React.FC<ValidatorHealthProps> = ({ data, loading = false }) => {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'healthy':
        return <CheckCircle size={24} className="text-green-400" />;
      case 'warning':
        return <AlertTriangle size={24} className="text-yellow-400" />;
      case 'error':
        return <XCircle size={24} className="text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (data.status) {
      case 'healthy':
        return 'Healthy';
      case 'warning':
        return 'Warning';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getLastBlockTimeText = () => {
    const secondsAgo = Math.floor((Date.now() - data.last_block_time) / 1000);
    return `${secondsAgo} seconds ago`;
  };

  const getUptimeWithColor = () => {
    return (
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-slate-50">{data.uptime.toFixed(2)}%</span>
        <span className="text-sm text-slate-400">Last block: {getLastBlockTimeText()}</span>
      </div>
    );
  };

  return (
    <MetricCard
      title="Validator Health"
      value={getStatusText()}
      icon={<Activity size={24} className="text-red-500" />}
      chart={getStatusIcon()}
      tooltipText="Shows the current health status of the validator node, uptime percentage, and time since last produced block."
      loading={loading}
    />
  );
};

export default ValidatorHealth;