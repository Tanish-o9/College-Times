import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  getFollowersPage, 
  getFollowingPage, 
  getFollowRequests, 
  acceptFollowRequest, 
  rejectFollowRequest 
} from '../../services/followService';
import { Users, UserCheck, UserPlus, ArrowLeft, RefreshCw, MessageSquare, ShieldAlert } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

type ConnectionsTab = 'following' | 'followers' | 'requests';

interface ConnectedUserPreview {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string;
}

export const ConnectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ConnectionsTab>('following');
  const [userList, setUserList] = useState<ConnectedUserPreview[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConnections = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let detailedUsers: ConnectedUserPreview[] = [];
      
      if (activeTab === 'requests') {
        const res = await getFollowRequests(currentUser.uid);
        for (const targetUid of res.uids) {
          const uSnap = await getDoc(doc(db, 'users', targetUid));
          if (uSnap.exists()) {
            const d = uSnap.data();
            detailedUsers.push({
              uid: uSnap.id,
              displayName: d.displayName || 'Campus Student',
              username: d.username,
              photoURL: d.photoURL,
            });
          }
        }
      } else {
        const res = activeTab === 'following'
          ? await getFollowingPage(currentUser.uid, 20)
          : await getFollowersPage(currentUser.uid, 20);

        for (const targetUid of res.uids) {
          const uSnap = await getDoc(doc(db, 'users', targetUid));
          if (uSnap.exists()) {
            const d = uSnap.data();
            detailedUsers.push({
              uid: uSnap.id,
              displayName: d.displayName || 'Campus Student',
              username: d.username,
              photoURL: d.photoURL,
            });
          }
        }
      }
      
      setUserList(detailedUsers);
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requesterUid: string) => {
    if (!currentUser) return;
    try {
      await acceptFollowRequest(currentUser.uid, requesterUid);
      toast.success('Follow request accepted! 🎉');
      setUserList((prev) => prev.filter((u) => u.uid !== requesterUid));
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept request.');
    }
  };

  const handleReject = async (requesterUid: string) => {
    if (!currentUser) return;
    try {
      await rejectFollowRequest(currentUser.uid, requesterUid);
      toast.success('Follow request deleted.');
      setUserList((prev) => prev.filter((u) => u.uid !== requesterUid));
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request.');
    }
  };

  useEffect(() => {
    loadConnections();
  }, [currentUser, activeTab]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-400" />
              <span>Campus Connections</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Your Campus Network</p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('following')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'following'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Following</span>
          </button>

          <button
            onClick={() => setActiveTab('followers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'followers'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Followers</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Requests</span>
          </button>
        </div>

        {/* User List */}
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading network connections...</span>
          </div>
        ) : userList.length === 0 ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
            No connections in this category.
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl divide-y divide-slate-800/60 overflow-hidden">
            {userList.map((u) => (
              <div key={u.uid} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt={u.displayName} className="w-10 h-10 rounded-2xl object-cover border border-slate-700" />
                  ) : (
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-sm">
                      {u.displayName[0].toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{u.displayName}</h4>
                    {u.username && <p className="text-[10px] text-sky-400 font-mono truncate">@{u.username}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeTab === 'requests' ? (
                    <>
                      <button
                        onClick={() => handleAccept(u.uid)}
                        className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl transition-all"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleReject(u.uid)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate(`/profile/${u.username || u.uid}`)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
                      >
                        View Profile
                      </button>
                      <button
                        onClick={() => navigate(`/direct/${u.uid}`)}
                        className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-semibold rounded-xl flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Message</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
