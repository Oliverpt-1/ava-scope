import React, { useEffect, useState, useCallback } from 'react';
import MetricCard from './MetricCard';
import { fetchChainMetric } from '../../utils/apiService';
import { FileCode, RefreshCw } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface Props {
  subnetId: string | null;
}

const ContractsDeployedWidget: React.FC<Props> = ({ subnetId }) => {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!subnetId) {
      setCount(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('subnets')
        .select('chain_id')
        .eq('id', subnetId)
        .maybeSingle();
      if (dbErr) throw dbErr;
      if (!data?.chain_id) throw new Error('chain_id not set');
      const chainId = data.chain_id as string;
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 60 * 60;
      const resp = await fetchChainMetric(chainId, 'cumulativeContracts', {
        startTimestamp: oneDayAgo,
        endTimestamp: now,
      });
      if ('error' in resp) throw new Error(resp.error);
      
      let latestVal: number | null = null;
      if (Array.isArray(resp) && resp.length > 0) {
        const lastPage = resp[resp.length - 1];
        if (lastPage && Array.isArray(lastPage.results) && lastPage.results.length > 0) {
             latestVal = lastPage.results[lastPage.results.length -1].value
        } else if (lastPage && typeof lastPage.value === 'number') {
            latestVal = lastPage.value;
        }
      } else if (resp && (resp as any).result?.value !== undefined) {
        latestVal = (resp as any).result.value;
      } else if (resp && typeof (resp as any).value === 'number') {
        latestVal = (resp as any).value;
      }

      console.log('[ContractsDeployedWidget] Fetched value:', latestVal, 'Full response:', resp);
      setCount(latestVal);
    } catch (err: any) {
      console.error('ContractsDeployedWidget error:', err);
      setError('Failed to load contract data');
      setCount(null);
    } finally {
      setLoading(false);
    }
  }, [subnetId]);

  if (error && !loading) {
    return <MetricCard title="Contracts Deployed" value="Error" icon={<FileCode size={24} className="text-red-500" />} tooltipText={error} onRefresh={fetchData} />;
  }

  if (!subnetId && !loading) {
    return <MetricCard title="Contracts Deployed" value="-" icon={<FileCode size={24} />} tooltipText="Select a subnet" />;
  }

  return (
    <MetricCard
      title="Contracts Deployed"
      value={count !== null ? count.toLocaleString() : '-'}
      icon={<FileCode size={24} className="text-red-500" />}
      loading={loading}
      tooltipText="Cumulative number of contracts deployed on this chain."
      onRefresh={fetchData}
    />
  );
};

export default ContractsDeployedWidget; 