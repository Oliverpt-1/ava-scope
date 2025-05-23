import React, { useState } from 'react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import FormInput from '../components/forms/FormInput';
import { useNavigate } from 'react-router-dom';

const Profile: React.FC = () => {
  const { user, signOut } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    
    try {
      setMessage('Profile updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Profile</h1>
        <p className="text-[var(--text-secondary)] mt-1">Manage your account settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-md p-6 border border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Account Information</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500 bg-opacity-10 border border-red-500 text-red-500 rounded-md text-sm">
                {error}
              </div>
            )}
            
            {message && (
              <div className="mb-4 p-3 bg-green-500 bg-opacity-10 border border-green-500 text-green-500 rounded-md text-sm">
                {message}
              </div>
            )}
            
            <form onSubmit={handleUpdateProfile}>
              <FormInput
                id="email"
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled
              />
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 transition duration-200 ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? 'Updating...' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
        
        <div>
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-md p-6 border border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Account Actions</h2>
            
            <div className="space-y-4">
              <button
                onClick={() => navigate('/reset')}
                className="w-full px-4 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-secondary)] transition duration-200 text-sm border border-[var(--border-color)]"
              >
                Change Password
              </button>
              
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 transition duration-200 text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Profile;