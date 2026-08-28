import React from 'react';
import { NotificationCenter } from '../../components/NotificationCenter';

export const NotificationsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <NotificationCenter />
    </div>
  );
};
