import React, { useEffect, useState, useCallback } from 'react';
import MetricCard from './MetricCard';
import { fetchStakingMetric } from '../../utils/apiService';
import { Users, RefreshCw } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface Props {
  subnetId: string | null;
}

const DelegatorCountWidget: React.FC<Props> = ({ subnetId }) => {
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
        .select('network')
        .eq('id', subnetId)
        .maybeSingle();
      if (dbErr) throw dbErr;
      const network = (data?.network as 'mainnet' | 'fuji' | 'testnet') || 'mainnet';
      const resp = await fetchStakingMetric(network, 'delegatorCount');
      if ('error' in resp) throw new Error(resp.error);

      // If resp is an array, use its length as the count.
      // Otherwise, attempt to use the previous logic as a fallback.
      let val = null;
      if (Array.isArray(resp)) {
        val = resp.length;
      } else {
        const first = Array.isArray(resp) && resp.length > 0 ? resp[0] : null;
        val = first?.results?.[0]?.value ?? null;
      }

      console.log('[DelegatorCountWidget] Processed value:', val, 'Full response:', resp);
      setCount(val);
    } catch (err: any) {
      console.error('DelegatorCountWidget error:', err);
      setError('Failed to load delegators');
      setCount(null);
    } finally {
      setLoading(false);
    }
  }, [subnetId]);

  if (error && !loading) {
    return <MetricCard title="Delegators" value="Error" icon={<Users size={24} className="text-red-500" />} tooltipText={error} onRefresh={fetchData} />;
  }
  if (!subnetId && !loading) {
    return <MetricCard title="Delegators" value="-" icon={<Users size={24} />} tooltipText="Select a subnet" />;
  }
  return (
    <MetricCard
      title="Delegators"
      value={count !== null ? count.toLocaleString() : '-'}
      icon={<Users size={24} className="text-red-500" />}
      loading={loading}
      tooltipText="Current delegator count for this subnet/network."
      onRefresh={fetchData}
    />
  );
};

export default DelegatorCountWidget; 