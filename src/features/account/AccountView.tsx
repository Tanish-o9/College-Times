import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getUserRank } from '../../services/userService';
import { 
  Award, 
  Phone, 
  Mail, 
  ShieldCheck, 
  RefreshCw, 
  Sparkles,
  LogOut,
  Trophy
} from 'lucide-react';
import toast from 'react-hot-toast';

export const AccountView: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, loading, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    if (userProfile && userProfile.points !== undefined) {
      getUserRank(userProfile.points).then((rank) => setUserRank(rank));
    }
  }, [userProfile]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    if (userProfile && userProfile.points !== undefined) {
      const rank = await getUserRank(userProfile.points);
      setUserRank(rank);
    }
    toast.success('Profile updated!', { id: 'profile-refreshed' });
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      // Error handled in authService toast
    } finally {
      setSigningOut(false);
    }
  };

  // Helper to extract initials for fallback avatar
  const getInitials = (name?: string) => {
    if (!name) return 'S';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
        <p className="text-sm font-medium">Loading account details...</p>
      </div>
    );
  }

  // Active state profile data or fallbacks if user document is loading/null
  const displayName = userProfile?.displayName || currentUser?.displayName || 'Student';
  const photoURL = userProfile?.photoURL || currentUser?.photoURL;
  const phone = userProfile?.phone || currentUser?.phoneNumber;
  const email = userProfile?.email || currentUser?.email;
  const points = userProfile?.points ?? 0;
  const role = userProfile?.role || 'student';

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      {/* Profile Card */}
      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Top Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <span className="px-3 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            {role} Profile
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing || signingOut}
              title="Refresh Profile"
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-all text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign Out"
              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-all text-xs flex items-center gap-1.5"
            >
              {signingOut ? (
                <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* User Info Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-8 text-center sm:text-left">
          {/* Avatar with fallback */}
          <div className="relative shrink-0">
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-slate-700 shadow-xl"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}

            {/* Initials Fallback if photoURL is missing or fails */}
            {!photoURL && (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 border-2 border-sky-400/30 shadow-xl flex items-center justify-center text-white text-2xl font-bold font-mono">
                {getInitials(displayName)}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white tracking-tight truncate mb-1">
              {displayName}
            </h1>
            <p className="text-xs text-slate-400 font-mono mb-3 truncate">
              UID: {currentUser?.uid || 'Not Authenticated'}
            </p>

            {/* Badges for Contact info */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              {phone && (
                <div className="px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-300 text-xs flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{phone}</span>
                </div>
              )}
              {email && (
                <div className="px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-300 text-xs flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-sky-400" />
                  <span>{email}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Points Counter Card */}
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {points} <span className="text-xs text-slate-400 font-normal">pts</span>
              </div>
              <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Leaderboard Rank #{userRank ?? '-'}</span>
              </div>
            </div>
          </div>

          {/* Role Status Card */}
          <div className="bg-gradient-to-br from-sky-500/10 to-indigo-500/10 border border-sky-500/20 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-white capitalize">
                {role}
              </div>
              <div className="text-xs text-slate-400 font-medium">
                Verified Campus Member
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            Firestore Sync Status
          </span>
          <span className="text-emerald-400 font-mono font-medium">
            {userProfile ? 'Document Synced' : 'Pending Login'}
          </span>
        </div>
      </div>
    </div>
  );
};

