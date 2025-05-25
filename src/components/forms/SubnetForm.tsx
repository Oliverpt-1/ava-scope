import React, { useState } from 'react';
import FormInput from './FormInput';
import { Subnet } from '../../types';

interface SubnetFormProps {
  subnet?: Subnet;
  onSubmit: (subnet: Omit<Subnet, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

const SubnetForm: React.FC<SubnetFormProps> = ({ subnet, onSubmit, onCancel }) => {
  const [name, setName] = useState(subnet?.name || '');
  const [rpcUrl, setRpcUrl] = useState(subnet?.rpc_url || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = 'Subnet name is required';
    }
    
    if (!rpcUrl.trim()) {
      newErrors.rpcUrl = 'RPC URL is required';
    } else if (!rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://')) {
      newErrors.rpcUrl = 'RPC URL must start with http:// or https://';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit({
        name,
        rpc_url: rpcUrl,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h2 className="text-xl font-semibold text-slate-100 mb-4">
        {subnet ? 'Edit Subnet' : 'Add New Subnet'}
      </h2>
      
      <FormInput
        id="subnet-name"
        label="Subnet Name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="My Subnet"
        error={errors.name}
        required
      />
      
      <FormInput
        id="rpc-url"
        label="RPC URL"
        type="text"
        value={rpcUrl}
        onChange={(e) => setRpcUrl(e.target.value)}
        placeholder="https://api.avax-test.network/ext/bc/C/rpc"
        error={errors.rpcUrl}
        required
      />
      
      <div className="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition duration-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 transition duration-200"
        >
          {subnet ? 'Update Subnet' : 'Add Subnet'}
        </button>
      </div>
    </form>
  );
};

export default SubnetForm;