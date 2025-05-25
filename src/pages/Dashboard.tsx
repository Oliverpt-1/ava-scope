import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/MainLayout';
import {
  RefreshCw, 
  AlertCircle, 
  ChevronDown, 
  // Other icons that might be used directly in Dashboard, if any
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Subnet } from '../types';

// Import new widgets
import TpsWidget from '../components/metrics/TpsWidget';
import LatestBlockWidget from '../components/metrics/LatestBlockWidget';
import Erc20TransfersWidget from '../components/metrics/Erc20TransfersWidget';
// import Erc721TransfersWidget from '../components/metrics/Erc721TransfersWidget'; // Removed
import GasUtilizationHistogram from '../components/metrics/GasUtilizationHistogram';
import MetricCard from '../components/metrics/MetricCard'; // For skeleton
// NEW: Zustand store to broadcast the selected subnet globally
import { useAppStore, AppState } from '../store/useAppStore';
import CrossChainWidget from '../components/metrics/CrossChainWidget';
import ValidatorCountWidget from '../components/metrics/ValidatorCountWidget';
import DelegatorCountWidget from '../components/metrics/DelegatorCountWidget';
import ContractsDeployedWidget from '../components/metrics/ContractsDeployedWidget';

const Dashboard: React.FC = () => {
  const [subnetsLoading, setSubnetsLoading] = useState(true);
  // metricsLoading is now handled by individual widgets, but we can keep a general loading for initial subnet load
  const [error, setError] = useState<string | null>(null);
  
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [selectedSubnet, setSelectedSubnet] = useState<Subnet | null>(null);
  const [showSubnetDropdown, setShowSubnetDropdown] = useState(false);
  const { user } = useAuth();
  const setSelectedSubnetIdGlobal = useAppStore((state: AppState) => state.setSelectedSubnetId);

  // Removed old individual metric states: averageTps, averageBlockTime, latestBlockNumber, mockData
  // Data fetching for these is now in respective widgets

  const fetchSubnets = useCallback(async () => {
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
        if (!selectedSubnet || !data.find(s => s.id === selectedSubnet.id)) { // if no subnet selected or current one is not in the new list
            setSelectedSubnet(data[0]);
            setSelectedSubnetIdGlobal(data[0].id); // Update global store as well
        }
      } else {
        setSubnets([]);
        setSelectedSubnet(null);
        // setError('No subnets found for this user. Please add one on the Subnets page.'); // User feedback
      }
    } catch (err: any) {
      console.error('Error in fetchSubnets:', err);
      setError('An unexpected error occurred while fetching subnets.');
    } finally {
      setSubnetsLoading(false);
    }
  }, [user, selectedSubnet]);

  useEffect(() => {
    fetchSubnets();
  }, [fetchSubnets]); // Removed selectedSubnet from dep array to avoid re-fetching just on selection change itself from here

  // Removed fetchDashboardMetrics as widgets fetch their own data based on selectedSubnet.id

  const handleRefresh = () => {
    // To refresh data in widgets, we can either:
    // 1. Force re-render by changing a `key` prop on widgets (e.g. key={selectedSubnet?.id + Date.now()})
    // 2. The widgets already have interval fetching. This button could simply re-fetch subnets
    //    if that list could change, or trigger an explicit re-fetch if widgets expose such a prop.
    // For now, widgets auto-refresh. If a more forceful manual refresh is needed, 
    // it might involve passing a refresh trigger prop to each widget.
    // Let's re-fetch subnets, which will also re-select the current one if it exists or the first one.
    fetchSubnets(); 
    // We could also just rely on the individual widget refresh intervals.
    // The current implementation of individual widgets re-fetches on subnetId change OR their own interval.
    // A simple refresh could be just to ensure the subnet list is up-to-date.
  };

  const handleSubnetSelect = (subnet: Subnet) => {
    setSelectedSubnet(subnet);
    setShowSubnetDropdown(false);
    // Widgets will automatically update due to change in selectedSubnet.id prop

    // Broadcast the selection so that AskAva (and potentially other widgets)
    // can reuse the same context without prop-drilling.
    setSelectedSubnetIdGlobal(subnet.id);
  };

  // Skeleton for individual cards (can be part of MetricCard itself)
  const renderWidgetSkeleton = (title: string, colSpanClass: string = '') => (
    <div className={colSpanClass}>
      <MetricCard title={title} loading={true} icon={<div className="w-6 h-6 bg-[var(--bg-primary)] rounded-full" />} />
    </div>
  );

  return (
    <MainLayout>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="flex-1 mb-4 sm:mb-0">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Subnet Dashboard</h1>
          <div className="relative mt-2">
            <button
              onClick={() => setShowSubnetDropdown(!showSubnetDropdown)}
              disabled={subnetsLoading || subnets.length === 0}
              className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed py-2 px-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)]"
            >
              <span>{selectedSubnet ? selectedSubnet.name : (subnetsLoading ? 'Loading subnets...' : (subnets.length === 0 ? 'No subnets found' : 'Select a Subnet'))}</span>
              <ChevronDown size={16} className={`transform transition-transform ${showSubnetDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showSubnetDropdown && (
              <div className="absolute z-20 mt-1 w-64 bg-[var(--bg-secondary)] rounded-lg shadow-xl border border-[var(--border-color)] py-1">
                {subnets.length > 0 ? subnets.map((subnet) => (
                  <button
                    key={subnet.id}
                    onClick={() => handleSubnetSelect(subnet)}
                    className={`w-full text-left px-4 py-2 hover:bg-[var(--bg-primary)] transition-colors ${
                      selectedSubnet?.id === subnet.id ? 'text-red-500 font-semibold' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {subnet.name}
                  </button>
                )) : (
                    <div className="px-4 py-2 text-[var(--text-secondary)]">No subnets available.</div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center">
          <button
            onClick={handleRefresh} // Refresh logic might need to be more sophisticated for widgets
            disabled={subnetsLoading || !selectedSubnet} // Disable if no subnet or still loading initial list
            className={`flex items-center px-3 py-2 text-sm rounded-md transition-all duration-300 ${
              (subnetsLoading || !selectedSubnet)
                ? 'bg-[var(--bg-action-disabled)] text-[var(--text-secondary)] cursor-not-allowed opacity-60'
                : 'bg-[var(--bg-action)] text-[var(--text-action)] hover:bg-[var(--bg-action-hover)]'
            }`}
          >
            <RefreshCw size={16} className={`mr-2 ${subnetsLoading ? 'animate-spin' : ''}`} /> 
            {subnetsLoading ? 'Loading...' : 'Refresh List'} 
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900 bg-opacity-30 border border-red-700 text-red-300 rounded-lg flex items-center whitespace-pre-line">
          <AlertCircle size={20} className="mr-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {subnetsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {renderWidgetSkeleton("TPS", "lg:col-span-2")}
          {renderWidgetSkeleton("Latest Block", "lg:col-span-2")}
          {renderWidgetSkeleton("ERC20 Transfers", "lg:col-span-4")}
          {/* ERC721 Skeleton removed */}
          {renderWidgetSkeleton("Gas Load (15 Min)", "lg:col-span-4")}
        </div>
      ) : !selectedSubnet && subnets.length > 0 ? (
         <div className="text-center py-10 text-[var(--text-secondary)]">
          <p className="text-lg">Please select a subnet to view its metrics.</p>
        </div>
      ) : !selectedSubnet && subnets.length === 0 && !subnetsLoading ? (
        <div className="text-center py-10">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No Subnets Found</h2>
          <p className="text-[var(--text-secondary)] mb-4">You haven't added any subnets to monitor yet.</p>
          {/* TODO: Add a link/button to the Subnets page e.g. <Link to="/subnets" className="text-red-500 hover:underline">Add Subnet</Link> */}
          <p className="text-[var(--text-secondary)]">Please add a subnet via the 'Subnets' page.</p>
        </div>
      ) : selectedSubnet ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-2">
            <TpsWidget subnetId={selectedSubnet.id} />
          </div>
          <div className="lg:col-span-2">
            <LatestBlockWidget subnetId={selectedSubnet.id} />
          </div>
          <div className="col-span-1 md:col-span-2 lg:col-span-4">
            <Erc20TransfersWidget subnetId={selectedSubnet.id} />
          </div>
          {/* Erc721TransfersWidget removed */}
          <div className="col-span-1 md:col-span-2 lg:col-span-4">
            <GasUtilizationHistogram subnetId={selectedSubnet.id} />
          </div>
          <div className="col-span-1 md:col-span-1 lg:col-span-1">
            <CrossChainWidget subnetId={selectedSubnet.id} />
          </div>
          <div className="col-span-1 md:col-span-1 lg:col-span-1">
            <ValidatorCountWidget subnetId={selectedSubnet.id} />
          </div>
          <div className="col-span-1 md:col-span-1 lg:col-span-1">
            <DelegatorCountWidget subnetId={selectedSubnet.id} />
          </div>
          <div className="col-span-1 md:col-span-1 lg:col-span-1">
            <ContractsDeployedWidget subnetId={selectedSubnet.id} />
          </div>
        </div>
      ) : (
        // Fallback, should ideally be covered by other states
        <div className="text-center py-10 text-[var(--text-secondary)]">
             <p>Loading dashboard or no data available.</p>
        </div>
      )
    }
    </MainLayout>
  );
};

export default Dashboard;