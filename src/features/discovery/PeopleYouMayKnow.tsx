import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sparkles } from 'lucide-react';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface SuggestedUser {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  department?: string;
}

export const PeopleYouMayKnow: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSuggestions = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const usersColRef = collection(db, 'users');
      const snap = await getDocs(query(usersColRef, limit(10)));

      const items: SuggestedUser[] = [];
      snap.docs.forEach((d) => {
        if (d.id !== currentUser.uid) {
          const data = d.data();
          items.push({
            uid: d.id,
            displayName: data.displayName || 'Campus Student',
            username: data.username,
            photoURL: data.photoURL,
            department: data.department,
          });
        }
      });
      setSuggestions(items.slice(0, 5));
    } catch (err) {
      console.error('Failed to load people suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [currentUser]);

  if (loading || suggestions.length === 0) return null;

  return (
    <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <span>Suggested for You</span>
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">Campus Network</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {suggestions.map((u) => (
          <div key={u.uid} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {u.photoURL ? (
                <img src={u.photoURL} alt={u.displayName} className="w-9 h-9 rounded-xl object-cover border border-slate-700" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-xs">
                  {u.displayName[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white truncate">{u.displayName}</h4>
                {u.username && <p className="text-[10px] text-sky-400 font-mono truncate">@{u.username}</p>}
              </div>
            </div>

            <button
              onClick={() => navigate(`/profile/${u.username || u.uid}`)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-xl shrink-0"
            >
              View
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
