import React, { useState, useEffect } from 'react';
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

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState(MOCK_DASHBOARD_DATA);
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [selectedSubnet, setSelectedSubnet] = useState<Subnet | null>(null);
  const [showSubnetDropdown, setShowSubnetDropdown] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchSubnets();
    }
  }, [user]);

  const fetchSubnets = async () => {
    try {
      const { data, error } = await supabase
        .from('subnets')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching subnets:', error);
        return;
      }

      if (data && data.length > 0) {
        setSubnets(data);
        setSelectedSubnet(data[0]);
      }
    } catch (err) {
      console.error('Error in fetchSubnets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      const newData = { ...MOCK_DASHBOARD_DATA };
      setDashboardData(newData);
      setRefreshing(false);
    }, 1000);
  };

  const handleSubnetSelect = (subnet: Subnet) => {
    setSelectedSubnet(subnet);
    setShowSubnetDropdown(false);
  };

  return (
    <MainLayout>
      <div className="mb-6 flex justify-between items-center">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Subnet Dashboard</h1>
          <div className="relative mt-2">
            <button
              onClick={() => setShowSubnetDropdown(!showSubnetDropdown)}
              className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <span>{selectedSubnet ? selectedSubnet.name : 'No subnet selected'}</span>
              <ChevronDown size={16} className={`transform transition-transform ${showSubnetDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showSubnetDropdown && (
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
                {subnets.length === 0 && (
                  <div className="px-4 py-2 text-[var(--text-secondary)]">No subnets available</div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex items-center px-3 py-2 text-sm rounded-md transition-all duration-300 ${
              refreshing
                ? 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-not-allowed'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <RefreshCw
              size={16}
              className={`mr-2 ${refreshing ? 'animate-spin' : ''}`}
            />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500 bg-opacity-10 border border-red-500 text-red-500 rounded-lg flex items-center">
          <AlertCircle size={20} className="mr-2" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ValidatorHealth data={dashboardData.validator} />
          <MempoolActivity data={dashboardData.mempool} />
          <TransactionMetrics data={dashboardData.transactions} />
          <GasMetrics data={dashboardData.gas} />
          <ContractActivity data={dashboardData.contracts} />
          <BlockProduction data={dashboardData.blocks} />
        </div>
      )}
    </MainLayout>
  );
};

export default Dashboard;