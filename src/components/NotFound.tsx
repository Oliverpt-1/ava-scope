import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
      <div className="text-center">
        <Activity size={48} className="text-red-500 mx-auto mb-6" />
        <h1 className="text-5xl font-bold text-[var(--text-primary)] mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-[var(--text-secondary)] mb-6">Page Not Found</h2>
        <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 transition duration-200"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;