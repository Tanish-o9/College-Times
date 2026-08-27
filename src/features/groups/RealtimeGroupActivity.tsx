import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Sparkles, RefreshCw } from 'lucide-react';

interface RealtimeGroupActivityProps {
  groupId: string;
  onRefresh?: () => void;
}

export const RealtimeGroupActivity: React.FC<RealtimeGroupActivityProps> = ({ groupId, onRefresh }) => {
  const [newActivityCount, setNewActivityCount] = useState(0);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    if (!groupId) return;

    const activityColRef = collection(db, 'groups', groupId, 'activity');
    const q = query(activityColRef, orderBy('createdAt', 'desc'), limit(10));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (!initialLoaded) {
          setInitialLoaded(true);
        } else {
          // Bounded activity update indicator
          if (!snap.empty) {
            setNewActivityCount((prev) => prev + 1);
          }
        }
      },
      (err) => {
        console.error('Failed to listen to group activity:', err);
      }
    );

    return () => unsubscribe();
  }, [groupId, initialLoaded]);

  if (newActivityCount === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-bounce">
      <button
        onClick={() => {
          setNewActivityCount(0);
          if (onRefresh) onRefresh();
        }}
        className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-full shadow-2xl flex items-center gap-2 transition-all border border-sky-300"
      >
        <Sparkles className="w-4 h-4" />
        <span>{newActivityCount} New Activity Updates</span>
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
