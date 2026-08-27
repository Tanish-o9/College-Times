import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PhoneLogin } from './PhoneLogin';

export const LoginPage: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (!loading && currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <PhoneLogin />
    </div>
  );
};

