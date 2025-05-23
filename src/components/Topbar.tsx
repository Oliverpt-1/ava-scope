import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bell, LogOut, User } from 'lucide-react';

const Topbar: React.FC = () => {
  const { user, signOut } = useAuth();
  
  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="h-16 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-between px-4">
      <div className="flex-1"></div>
      
      <div className="flex items-center space-x-4">
        <button className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-full hover:bg-[var(--bg-primary)]">
          <Bell size={20} />
        </button>
        
        <div className="flex items-center">
          <div className="mr-3 text-right hidden sm:block">
            <p className="text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-[var(--text-secondary)]">Administrator</p>
          </div>
          
          <div className="relative group">
            <button className="w-9 h-9 rounded-full bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors">
              {user?.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt="User avatar" 
                  className="rounded-full w-full h-full object-cover" 
                />
              ) : (
                <User size={18} />
              )}
            </button>
            
            <div className="absolute right-0 mt-2 w-48 py-1 bg-[var(--bg-secondary)] rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 border border-[var(--border-color)]">
              <a href="/profile" className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-primary)]">Profile</a>
              <a href="/settings" className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-primary)]">Settings</a>
              <button 
                onClick={handleSignOut} 
                className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[var(--bg-primary)] flex items-center"
              >
                <LogOut size={16} className="mr-2" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Topbar;