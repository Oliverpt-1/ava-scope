import React from 'react';
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
  X 
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, isMobile }) => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/subnets', label: 'Subnets', icon: <Database size={20} /> },
    { path: '/profile', label: 'Profile', icon: <User size={20} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const sidebarWidthClass = isOpen ? 'w-64' : 'w-20';
  const iconContainerClass = isOpen ? 'mr-3' : 'mx-auto';
  const navLinkJustifyClass = isOpen ? 'justify-start' : 'justify-center';

  return (
    <div 
      className={`${sidebarWidthClass} h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] fixed top-0 left-0 transition-all duration-300 ease-in-out z-20 border-r border-[var(--border-color)] flex flex-col`}
    >
      <div className="flex items-center p-4 h-[65px] border-b border-[var(--border-color)] ${
        isOpen ? 'justify-end' : 'justify-center'
      }">
        <button 
          onClick={toggleSidebar} 
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1"
          aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
        
      <nav className="mt-2 flex-grow overflow-y-auto">
        <ul>
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
              className={`flex items-center p-4 ${navLinkJustifyClass} ${
                location.pathname === item.path
                  ? 'bg-[var(--bg-primary)] text-red-500'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
              } transition-colors duration-200`}
              >
                <span className={iconContainerClass}>{item.icon}</span>
                {isOpen && <span>{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
        
      <div className="border-t border-[var(--border-color)]">
        <button
          onClick={toggleTheme}
          className={`flex items-center p-4 w-full ${navLinkJustifyClass} text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-colors duration-200`}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={20} className={iconContainerClass} />
              {isOpen && <span>Light Mode</span>}
            </>
          ) : (
            <>
              <Moon size={20} className={iconContainerClass} />
              {isOpen && <span>Dark Mode</span>}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;