import React, { useEffect, useState, useCallback } from 'react';
import MetricCard from './MetricCard';
import { fetchStakingMetric } from '../../utils/apiService';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface Props {
  subnetId: string | null;
}

const ValidatorCountWidget: React.FC<Props> = ({ subnetId }) => {
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
      const resp = await fetchStakingMetric(network, 'validatorCount');
      if ('error' in resp) throw new Error(resp.error);
      
      // If resp is an array, use its length as the count.
      // Otherwise, attempt to use the previous logic as a fallback (though it seems the array length is what we need).
      let val = null;
      if (Array.isArray(resp)) {
        val = resp.length;
      } else {
        // Fallback for a different expected structure, though current logs suggest this won't be hit
        const first = Array.isArray(resp) && resp.length > 0 ? resp[0] : null; // This line is redundant if resp is not an array here
        val = first?.results?.[0]?.value ?? null;
      }
      
      console.log('[ValidatorCountWidget] Processed value:', val, 'Full response:', resp);
      setCount(val);
    } catch (err: any) {
      console.error('ValidatorCountWidget error:', err);
      setError('Failed to load validators');
      setCount(null);
    } finally {
      setLoading(false);
    }
  }, [subnetId]);

  if (error && !loading) {
    return <MetricCard title="Validators" value="Error" icon={<ShieldCheck size={24} className="text-red-500" />} tooltipText={error} onRefresh={fetchData} />;
  }
  if (!subnetId && !loading) {
    return <MetricCard title="Validators" value="-" icon={<ShieldCheck size={24} />} tooltipText="Select a subnet" />;
  }
  return (
    <MetricCard
      title="Validators"
      value={count !== null ? count.toLocaleString() : '-'}
      icon={<ShieldCheck size={24} className="text-red-500" />}
      loading={loading}
      tooltipText="Current validator count for this subnet/network."
      onRefresh={fetchData}
    />
  );
};

export default ValidatorCountWidget; 