import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/MainLayout';
import ValidatorHealth from '../components/metrics/ValidatorHealth';
import MempoolActivity from '../components/metrics/MempoolActivity';
import TransactionMetrics from '../components/metrics/TransactionMetrics';
import GasMetrics from '../components/metrics/GasMetrics';
import ContractActivity from '../components/metrics/ContractActivity';
import BlockProduction from '../components/metrics/BlockProduction';
import { RefreshCw, AlertCircle, ChevronDown } from 'lucide-react';
import { MOCK_DASHBOARD_DATA } from '../utils/mockData';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Subnet } from '../types';
import {
  fetchAverageTps,
  fetchAverageBlockTime,
  fetchBlocktimeSamples,
  AverageDataResponse,
  BlocktimeSampleFE,
} from '../utils/apiService';

const Dashboard: React.FC = () => {
  const [subnetsLoading, setSubnetsLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [selectedSubnet, setSelectedSubnet] = useState<Subnet | null>(null);
  const [showSubnetDropdown, setShowSubnetDropdown] = useState(false);
  const { user } = useAuth();

  const [averageTps, setAverageTps] = useState<number | null>(null);
  const [averageBlockTime, setAverageBlockTime] = useState<number | null>(null);
  const [latestBlockNumber, setLatestBlockNumber] = useState<number | null>(null);
  const [mockData, setMockData] = useState(MOCK_DASHBOARD_DATA);

  const fetchSubnetsAndInitialMetrics = useCallback(async () => {
    if (!user) return;
    setSubnetsLoading(true);
    setError(null);
    try {
      const { data, error: subnetsError } = await supabase
        .from('subnets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (subnetsError) {
        console.error('Error fetching subnets:', subnetsError);
        setError('Failed to fetch subnets. ' + subnetsError.message);
        setSubnets([]);
        setSelectedSubnet(null);
        return;
      }

      if (data && data.length > 0) {
        setSubnets(data);
        setSelectedSubnet(data[0]);
        await fetchDashboardMetrics(data[0].id);
      } else {
        setSubnets([]);
        setSelectedSubnet(null);
      }
    } catch (err: any) {
      console.error('Error in fetchSubnetsAndInitialMetrics:', err);
      setError('An unexpected error occurred while fetching subnets.');
    } finally {
      setSubnetsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubnetsAndInitialMetrics();
  }, [fetchSubnetsAndInitialMetrics]);

  const fetchDashboardMetrics = async (subnetId: string) => {
    if (!subnetId) return;
    setMetricsLoading(true);
    setError(null);
    setAverageTps(null);
    setAverageBlockTime(null);
    setLatestBlockNumber(null);

    try {
      const tpsData = await fetchAverageTps(subnetId);
      if ('error' in tpsData) {
        console.error('Error fetching average TPS:', tpsData.error, tpsData.details);
        setError(prev => prev ? `${prev}\nFailed to fetch average TPS.` : 'Failed to fetch average TPS.');
      } else {
        setAverageTps(tpsData.avg_value);
      }

      const blockTimeAvgData = await fetchAverageBlockTime(subnetId);
      if ('error' in blockTimeAvgData) {
        console.error('Error fetching average block time:', blockTimeAvgData.error, blockTimeAvgData.details);
        setError(prev => prev ? `${prev}\nFailed to fetch average block time.` : 'Failed to fetch average block time.');
      } else {
        setAverageBlockTime(blockTimeAvgData.avg_value);
      }

      const blocktimeSamplesData = await fetchBlocktimeSamples(subnetId);
      if ('error' in blocktimeSamplesData) {
        console.error('Error fetching blocktime samples:', blocktimeSamplesData.error, blocktimeSamplesData.details);
        setError(prev => prev ? `${prev}\nFailed to fetch blocktime samples.` : 'Failed to fetch blocktime samples.');
      } else if (blocktimeSamplesData.length > 0) {
        setLatestBlockNumber(blocktimeSamplesData[blocktimeSamplesData.length - 1].block_number);
      }

    } catch (err: any) {
      console.error('Error fetching dashboard metrics:', err);
      setError('An unexpected error occurred while fetching metrics.');
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (selectedSubnet) {
      fetchDashboardMetrics(selectedSubnet.id);
    }
  };

  const handleSubnetSelect = (subnet: Subnet) => {
    setSelectedSubnet(subnet);
    setShowSubnetDropdown(false);
    fetchDashboardMetrics(subnet.id);
  };

  const isLoading = subnetsLoading || metricsLoading;

  return (
    <MainLayout>
      <div className="mb-6 flex justify-between items-center">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Subnet Dashboard</h1>
          <div className="relative mt-2">
            <button
              onClick={() => setShowSubnetDropdown(!showSubnetDropdown)}
              disabled={subnetsLoading || subnets.length === 0}
              className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{selectedSubnet ? selectedSubnet.name : (subnetsLoading ? 'Loading subnets...' : 'No subnet selected')}</span>
              <ChevronDown size={16} className={`transform transition-transform ${showSubnetDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showSubnetDropdown && subnets.length > 0 && (
              <div className="absolute z-10 mt-2 w-64 bg-[var(--bg-secondary)] rounded-lg shadow-lg border border-[var(--border-color)] py-1">
                {subnets.map((subnet) => (
                  <button
                    key={subnet.id}
                    onClick={() => handleSubnetSelect(subnet)}
                    className={`w-full text-left px-4 py-2 hover:bg-[var(--bg-primary)] transition-colors ${
                      selectedSubnet?.id === subnet.id ? 'text-red-500' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {subnet.name}
                  </button>
                ))}
              </div>
            )}
             {showSubnetDropdown && subnets.length === 0 && !subnetsLoading && (
                <div className="absolute z-10 mt-2 w-64 bg-[var(--bg-secondary)] rounded-lg shadow-lg border border-[var(--border-color)] py-1 px-4 text-[var(--text-secondary)]">
                    No subnets found for this user.
                </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center">
          <button
            onClick={handleRefresh}
            disabled={metricsLoading || !selectedSubnet}
            className={`flex items-center px-3 py-2 text-sm rounded-md transition-all duration-300 ${
              (metricsLoading || !selectedSubnet)
                ? 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-not-allowed opacity-50'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <RefreshCw size={16} className={`mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
            {metricsLoading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500 bg-opacity-10 border border-red-500 text-red-500 rounded-lg flex items-center whitespace-pre-line">
          <AlertCircle size={20} className="mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {subnetsLoading ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="bg-[var(--bg-secondary)] rounded-lg p-5 shadow-md border border-[var(--border-color)] h-64">
              <div className="animate-pulse">
                <div className="flex justify-between items-center mb-4">
                  <div className="h-6 bg-[var(--bg-primary)] rounded w-24"></div>
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-primary)]"></div>
                </div>
                <div className="h-10 bg-[var(--bg-primary)] rounded mb-4"></div>
                <div className="h-28 bg-[var(--bg-primary)] rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : !selectedSubnet && !subnetsLoading ? (
        <div className="text-center py-10 text-[var(--text-secondary)]">
          <p>No subnet selected or no subnets available for this user.</p>
          <p>Please add a subnet via the 'Subnets' page if you haven't already.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ValidatorHealth data={mockData.validator} />
          <MempoolActivity data={mockData.mempool} />
          <TransactionMetrics tps={averageTps} />
          <GasMetrics data={mockData.gas} />
          <ContractActivity data={mockData.contracts} />
          <BlockProduction 
            latestBlock={latestBlockNumber} 
            avgBlockTime={averageBlockTime}
            transactions={null}
            size={null}
          />
        </div>
      )}
    </MainLayout>
  );
};

export default Dashboard;