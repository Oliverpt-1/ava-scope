import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { 
  LayoutDashboard, 
  Database, 
  User, 
  Settings, 
  Sun, 
  Moon, 
  Menu, 
  X,
  Activity
} from 'lucide-react';

interface SidebarProps {
  isMobile: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isMobile }) => {
  const [expanded, setExpanded] = useState(!isMobile);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const toggleSidebar = () => {
    setExpanded(!expanded);
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/subnets', label: 'Subnets', icon: <Database size={20} /> },
    { path: '/profile', label: 'Profile', icon: <User size={20} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <div 
      className={`${
        expanded ? 'w-64' : 'w-20'
      } h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] fixed left-0 top-0 transition-all duration-300 ease-in-out z-20 border-r border-[var(--border-color)]`}
    >
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
        <div className={`flex items-center ${expanded ? 'justify-start' : 'justify-center w-full'}`}>
          <Activity size={24} className="text-red-500 mr-2" />
          {expanded && <span className="text-xl font-semibold">AvaScope</span>}
        </div>
        <button 
          onClick={toggleSidebar} 
          className={`text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ${expanded ? '' : 'hidden'}`}
        >
          {expanded ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      
      {!expanded && (
        <button 
          onClick={toggleSidebar} 
          className="p-4 w-full flex justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Menu size={20} />
        </button>
      )}
      
      <nav className="mt-6">
        <ul>
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center p-4 ${
                  expanded ? 'justify-start' : 'justify-center'
                } ${
                  location.pathname === item.path
                    ? 'bg-[var(--bg-primary)] text-red-500'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
                } transition-colors duration-200`}
              >
                <span className="mr-3">{item.icon}</span>
                {expanded && <span>{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="absolute bottom-0 w-full border-t border-[var(--border-color)]">
        <button
          onClick={toggleTheme}
          className={`flex items-center p-4 w-full ${
            expanded ? 'justify-start' : 'justify-center'
          } text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-colors duration-200`}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={20} className="mr-3" />
              {expanded && <span>Light Mode</span>}
            </>
          ) : (
            <>
              <Moon size={20} className="mr-3" />
              {expanded && <span>Dark Mode</span>}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;