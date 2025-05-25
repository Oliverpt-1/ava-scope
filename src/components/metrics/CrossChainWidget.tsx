import React, { useEffect, useState, useCallback } from 'react';
import MetricCard from './MetricCard';
import { fetchTeleporterMetric } from '../../utils/apiService';
import { Link as LinkIcon, RefreshCw } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface CrossChainWidgetProps {
  subnetId: string | null;
}

const CrossChainWidget: React.FC<CrossChainWidgetProps> = ({ subnetId }) => {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!subnetId) {
      setValue(null);
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
      if (!data || !data.chain_id) {
        throw new Error('chain_id not set for subnet');
      }
      const chainId = data.chain_id as string;
      const resp = await fetchTeleporterMetric(chainId, 'teleporterTotalTxnCount');
      if ('error' in resp) {
        throw new Error(resp.error);
      }
      const val = (resp as any).result?.value ?? null;
      console.log('[CrossChainWidget] Fetched value:', val, 'Full response:', resp);
      setValue(val);
    } catch (err: any) {
      console.error('CrossChainWidget error:', err);
      setError('Failed to load cross-chain metric');
      setValue(null);
    } finally {
      setLoading(false);
    }
  }, [subnetId]);

  if (error && !loading) {
    return (
      <MetricCard
        title="Cross-Chain Messages"
        value="Error"
        icon={<LinkIcon size={24} className="text-red-500" />}
        tooltipText={error}
        onRefresh={fetchData}
      />
    );
  }

  if (!subnetId && !loading) {
    return (
      <MetricCard
        title="Cross-Chain Messages"
        value="-"
        icon={<LinkIcon size={24} />}
        tooltipText="Select a subnet to view cross-chain metrics."
      />
    );
  }

  return (
    <MetricCard
      title="Cross-Chain Messages"
      value={value !== null ? value.toLocaleString() : '-'}
      icon={<LinkIcon size={24} className="text-red-500" />}
      loading={loading}
      tooltipText="Total Teleporter messages sent + received on this chain (cumulative)."
      onRefresh={fetchData}
    />
  );
};

export default CrossChainWidget; 