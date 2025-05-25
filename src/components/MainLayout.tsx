import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  // Sidebar is closed by default on all screen sizes initially
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // If screen becomes mobile, ensure sidebar is closed
      if (mobile && sidebarOpen) { // Only close if it was open
        setSidebarOpen(false);
      }
      // On desktop, retain current sidebarOpen state, don't force open/close on resize.
      // The initial state is set to false, user interaction or specific logic can open it.
    };

    window.addEventListener('resize', handleResize);
    // Initial check for mobile state
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]); // Added sidebarOpen to dependencies to correctly react if it was open on mobile resize

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Pass isMobile to Sidebar if it needs to adapt its own internal behavior/styles for mobile, 
          though its open/close state is now fully controlled by MainLayout's sidebarOpen state. */}
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} isMobile={isMobile} />
      
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <Topbar />
        <main className="p-6 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;