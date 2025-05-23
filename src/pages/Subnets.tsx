import React, { useState, useEffect } from 'react';
import MainLayout from '../components/MainLayout';
import SubnetsList from '../components/SubnetsList';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import { Subnet } from '../types';
import { useNavigate } from 'react-router-dom';

const Subnets: React.FC = () => {
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (user) {
      fetchSubnets();
    }
  }, [user]);
  
  const fetchSubnets = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('subnets')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        setError(error.message);
        return;
      }
      
      setSubnets(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch subnets');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddSubnet = async (subnet: Omit<Subnet, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('subnets')
        .insert([
          {
            ...subnet,
            user_id: user?.id,
          },
        ])
        .select();
      
      if (error) {
        setError(error.message);
        return;
      }
      
      if (data) {
        setSubnets([...data, ...subnets]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add subnet');
    }
  };
  
  const handleEditSubnet = async (id: string, subnet: Omit<Subnet, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('subnets')
        .update(subnet)
        .eq('id', id)
        .eq('user_id', user?.id);
      
      if (error) {
        setError(error.message);
        return;
      }
      
      setSubnets(
        subnets.map((s) => (s.id === id ? { ...s, ...subnet } : s))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update subnet');
    }
  };
  
  const handleDeleteSubnet = async (id: string) => {
    try {
      const { error } = await supabase
        .from('subnets')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
      
      if (error) {
        setError(error.message);
        return;
      }
      
      setSubnets(subnets.filter((s) => s.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete subnet');
    }
  };
  
  const handleSelectSubnet = (subnet: Subnet) => {
    navigate('/');
  };
  
  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Manage Subnets</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Add, edit, or remove your Avalanche subnets
        </p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-500 bg-opacity-10 border border-red-500 text-red-500 rounded-lg">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-[var(--bg-primary)] rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="h-20 bg-[var(--bg-primary)] rounded"></div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <SubnetsList
          subnets={subnets}
          onAddSubnet={handleAddSubnet}
          onEditSubnet={handleEditSubnet}
          onDeleteSubnet={handleDeleteSubnet}
          onSelectSubnet={handleSelectSubnet}
        />
      )}
    </MainLayout>
  );
};

export default Subnets;