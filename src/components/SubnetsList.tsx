import React, { useState } from 'react';
import { Subnet } from '../types';
import { Edit2, Trash2, Plus } from 'lucide-react';
import SubnetForm from './forms/SubnetForm';

interface SubnetsListProps {
  subnets: Subnet[];
  onAddSubnet: (subnet: Omit<Subnet, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
  onEditSubnet: (id: string, subnet: Omit<Subnet, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
  onDeleteSubnet: (id: string) => void;
  onSelectSubnet: (subnet: Subnet) => void;
  selectedSubnetId?: string;
}

const SubnetsList: React.FC<SubnetsListProps> = ({
  subnets,
  onAddSubnet,
  onEditSubnet,
  onDeleteSubnet,
  onSelectSubnet,
  selectedSubnetId,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<Subnet | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleEdit = (subnet: Subnet) => {
    setEditingSubnet(subnet);
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const handleSubmitEdit = (updatedSubnet: Omit<Subnet, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (editingSubnet) {
      onEditSubnet(editingSubnet.id, updatedSubnet);
      setEditingSubnet(null);
    }
  };

  const handleSubmitAdd = (newSubnet: Omit<Subnet, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    onAddSubnet(newSubnet);
    setShowAddForm(false);
  };

  const confirmDelete = (id: string) => {
    onDeleteSubnet(id);
    setShowDeleteConfirm(null);
  };

  if (editingSubnet) {
    return (
      <SubnetForm
        subnet={editingSubnet}
        onSubmit={handleSubmitEdit}
        onCancel={() => setEditingSubnet(null)}
      />
    );
  }

  if (showAddForm) {
    return (
      <SubnetForm
        onSubmit={handleSubmitAdd}
        onCancel={() => setShowAddForm(false)}
      />
    );
  }

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)]">
        <h2 className="text-lg font-medium text-[var(--text-primary)]">Your Subnets</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-500 transition duration-200 text-sm"
        >
          <Plus size={16} className="mr-1" /> Add Subnet
        </button>
      </div>

      {subnets.length === 0 ? (
        <div className="p-6 text-center text-[var(--text-secondary)]">
          <p>You don't have any subnets yet.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 text-red-500 hover:text-red-400 transition duration-200"
          >
            Add your first subnet
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border-color)]">
          {subnets.map((subnet) => (
            <li key={subnet.id} className="relative">
              {showDeleteConfirm === subnet.id && (
                <div className="absolute inset-0 bg-[var(--bg-secondary)] bg-opacity-90 flex items-center justify-center z-10">
                  <div className="bg-[var(--bg-primary)] p-4 rounded-md shadow-lg text-center border border-[var(--border-color)]">
                    <p className="text-[var(--text-primary)] mb-4">Are you sure you want to delete this subnet?</p>
                    <div className="flex justify-center space-x-3">
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="px-3 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-primary)] transition duration-200 border border-[var(--border-color)]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => confirmDelete(subnet.id)}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-500 transition duration-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div 
                className={`p-4 hover:bg-[var(--bg-primary)] transition duration-200 cursor-pointer ${
                  selectedSubnetId === subnet.id ? 'bg-[var(--bg-primary)]' : ''
                }`}
                onClick={() => onSelectSubnet(subnet)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)]">{subnet.name}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{subnet.rpc_url}</p>
                    {subnet.notes && (
                      <p className="text-sm text-[var(--text-secondary)] mt-2 line-clamp-2">{subnet.notes}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(subnet);
                      }}
                      className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition duration-200"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(subnet.id);
                      }}
                      className="p-1.5 text-[var(--text-secondary)] hover:text-red-400 hover:bg-[var(--bg-secondary)] rounded-md transition duration-200"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SubnetsList;