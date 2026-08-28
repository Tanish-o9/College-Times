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
  Trophy,
  AtSign,
  GraduationCap,
  Calendar,
  ExternalLink,
  Edit2
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
  
  // Custom Profile fields
  const username = userProfile?.username || '';
  const bio = (userProfile as any)?.bio || '';
  const department = userProfile?.department || '';
  const batchYear = userProfile?.batchYear || null;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      {/* Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
        {/* Glow backdrops */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl -z-10 pointer-events-none animate-pulse" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Top Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <span className="px-3.5 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-inner">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            {role} Profile
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing || signingOut}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700/60 transition-all text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-400' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-all text-xs font-semibold flex items-center gap-1.5"
            >
              {signingOut ? (
                <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* User Info Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with fallback */}
          <div className="relative shrink-0 select-none">
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="w-24 h-24 rounded-3xl object-cover border-2 border-slate-800 shadow-2xl"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}

            {/* Initials Fallback if photoURL is missing or fails */}
            {!photoURL && (
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 border-2 border-sky-400/30 shadow-2xl flex items-center justify-center text-white text-2xl font-bold font-mono">
                {getInitials(displayName)}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight truncate">
                {displayName}
              </h1>
              {username && (
                <p className="text-sm font-semibold font-mono text-purple-400 flex items-center justify-center sm:justify-start gap-0.5 mt-0.5">
                  <AtSign className="w-3.5 h-3.5" />
                  <span>{username}</span>
                </p>
              )}
            </div>

            {bio && (
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 inline-block text-left max-w-md w-full">
                <span className="font-semibold text-slate-400 block text-[9px] uppercase tracking-wider mb-1">About Me</span>
                {bio}
              </p>
            )}

            {/* Quick stats for Department & Batch */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              {department && (
                <span className="px-3 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {department}
                </span>
              )}
              {batchYear && (
                <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Batch {batchYear}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Custom Actions (Edit Profile & View Public Profile) */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => navigate('/settings/profile')}
            className="w-full py-3 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-200 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md"
          >
            <Edit2 className="w-4 h-4 text-sky-400" />
            <span>Edit Profile Details</span>
          </button>

          <button
            onClick={() => navigate(`/profile/${username || currentUser?.uid}`)}
            className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/10"
          >
            <ExternalLink className="w-4 h-4" />
            <span>View Public Profile</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Points Counter Card */}
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6 animate-pulse" />
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
          <div className="bg-gradient-to-br from-sky-500/10 to-indigo-500/10 border border-sky-500/20 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
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

        {/* Contact Info Footer Details */}
        <div className="bg-slate-950/60 rounded-2xl border border-slate-800/80 p-4 space-y-2.5">
          <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Account Credentials</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {email && (
              <div className="px-3.5 py-2.5 bg-slate-900 border border-slate-800/60 rounded-xl text-slate-300 flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="truncate">{email}</span>
              </div>
            )}
            {phone && (
              <div className="px-3.5 py-2.5 bg-slate-900 border border-slate-800/60 rounded-xl text-slate-300 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="p-3.5 bg-slate-950/30 rounded-2xl border border-slate-800/50 text-[10px] text-slate-500 flex items-center justify-between font-mono">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            VITE_FIREBASE_SYNC
          </span>
          <span className="text-emerald-500 font-bold uppercase">
            {userProfile ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
};
