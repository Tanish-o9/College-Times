import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';

export const RequireAdmin: React.FC = () => {
  const { currentUser, userProfile, loading } = useAuth();
  const toastFiredRef = useRef(false);

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (!loading && (!currentUser || !isAdmin) && !toastFiredRef.current) {
      toastFiredRef.current = true;
      toast.error('Admins only. Redirecting to home...', { id: 'admin-gated' });
    }
  }, [loading, currentUser, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-[70vvh] flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center animate-spin">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Verifying Admin Authorization...</p>
      </div>
    );
  }

  if (!currentUser || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
