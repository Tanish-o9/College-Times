import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { followUser, unfollowUser, isFollowingUser } from '../../services/followService';
import { claimUsername } from '../../services/usernameService';
import type { UserProfile2 } from '../../types/profile';
import {
  UserCheck,
  UserPlus,
  MessageSquare,
  ArrowLeft,
  RefreshCw,
  AtSign,
  Settings,
  GraduationCap,
  Hash,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile2 | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [claiming, setClaiming] = useState(false);

  const loadProfile = async () => {
    if (!username) return;
    setLoading(true);
    try {
      const cleanName = username.startsWith('@') ? username.slice(1) : username;
      const usernameDocRef = doc(db, 'usernames', cleanName.toLowerCase());
      const usernameSnap = await getDoc(usernameDocRef);

      let targetUid = '';
      if (usernameSnap.exists()) {
        targetUid = usernameSnap.data().uid;
      } else {
        // Fallback UID lookup
        targetUid = cleanName;
      }

      const userDocRef = doc(db, 'users', targetUid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setProfile({
          uid: userSnap.id,
          displayName: data.displayName || 'Campus Student',
          username: data.username || cleanName,
          photoURL: data.photoURL,
          bio: data.bio,
          department: data.department,
          batchYear: data.batchYear,
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
          profileVisibility: data.profileVisibility || 'public',
          profileStatus: data.profileStatus || 'active',
          createdAt: data.createdAt,
        });

        if (currentUser && currentUser.uid !== targetUid) {
          const followingStatus = await isFollowingUser(currentUser.uid, targetUid);
          setIsFollowing(followingStatus);
        }
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [username, currentUser]);

  const handleFollowToggle = async () => {
    if (!profile || !currentUser || actionBusy) return;
    setActionBusy(true);
    try {
      if (isFollowing) {
        await unfollowUser(currentUser.uid, profile.uid);
        setIsFollowing(false);
        setProfile((prev) => (prev ? { ...prev, followersCount: Math.max(0, prev.followersCount - 1) } : null));
        toast.success(`Unfollowed @${profile.username}`);
      } else {
        const isPublic = profile.profileVisibility === 'public';
        const result = await followUser(currentUser.uid, profile.uid, !isPublic);
        if (result) {
          setIsFollowing(true);
          setProfile((prev) => (prev ? { ...prev, followersCount: prev.followersCount + 1 } : null));
          toast.success(`Following @${profile.username}`);
        } else {
          toast.success(`Follow request sent to @${profile.username}`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleClaimUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newUsername.trim() || claiming) return;

    setClaiming(true);
    try {
      const claimed = await claimUsername(currentUser.uid, newUsername.trim());
      toast.success(`Username @${claimed} claimed successfully!`);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to claim username.');
    } finally {
      setClaiming(false);
    }
  };

  const isSelf = currentUser && profile && currentUser.uid === profile.uid;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white">
              {profile ? profile.displayName : 'Campus Profile'}
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              @{profile?.username || 'user'}
            </p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading campus profile...</span>
          </div>
        ) : !profile ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-4">
            <p className="text-slate-400 text-xs">Profile not found.</p>
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-sky-500 text-slate-950 font-bold text-xs rounded-xl">
              Back to Home
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Identity Card Header */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-6 shadow-xl relative">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {profile.photoURL ? (
                    <img src={profile.photoURL} alt={profile.displayName} className="w-20 h-20 rounded-3xl object-cover border-2 border-sky-500/40" />
                  ) : (
                    <div className="w-20 h-20 rounded-3xl bg-sky-500/10 border-2 border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-2xl">
                      {profile.displayName[0].toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h2 className="text-xl font-bold text-white">{profile.displayName}</h2>
                    <p className="text-xs font-mono text-sky-400 font-semibold mt-0.5">@{profile.username}</p>
                    {profile.bio && <p className="text-xs text-slate-300 mt-2 leading-relaxed max-w-md">{profile.bio}</p>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  {isSelf ? (
                    <button
                      onClick={() => navigate('/settings/profile')}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Settings className="w-4 h-4 text-sky-400" />
                      <span>Edit Profile</span>
                    </button>
                  ) : currentUser && (
                    <>
                      <button
                        onClick={handleFollowToggle}
                        disabled={actionBusy}
                        className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                          isFollowing
                            ? 'bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700'
                            : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md'
                        }`}
                      >
                        {actionBusy ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : isFollowing ? (
                          <>
                            <UserCheck className="w-4 h-4 text-emerald-400" />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          import('../../services/directMessageService').then(({ getOrCreateConversation }) => {
                            getOrCreateConversation(profile.uid, currentUser!, profile.displayName)
                              .then((conv) => navigate(`/messages/${conv.id}`))
                              .catch(() => navigate('/messages'));
                          });
                        }}
                        className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-4 h-4 text-sky-400" />
                        <span>Message</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Stats Strip */}
              <div className="flex items-center gap-8 pt-4 border-t border-slate-800 text-xs font-mono">
                <div>
                  <span className="font-bold text-white text-sm">{profile.followersCount}</span>
                  <span className="text-slate-400 ml-1.5">Followers</span>
                </div>
                <div>
                  <span className="font-bold text-white text-sm">{profile.followingCount}</span>
                  <span className="text-slate-400 ml-1.5">Following</span>
                </div>
              </div>

              {/* Department / Batch / Interests */}
              {(profile.department || profile.batchYear || (profile as any)?.interests?.length > 0) && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800">
                  {profile.department && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-full text-[11px] font-semibold">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {profile.department}
                    </span>
                  )}
                  {profile.batchYear && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full text-[11px] font-semibold">
                      <Hash className="w-3.5 h-3.5" />
                      Batch {profile.batchYear}
                    </span>
                  )}
                  {((profile as any)?.interests || []).map((interest: string) => (
                    <span
                      key={interest}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-full text-[11px] font-medium"
                    >
                      <Tag className="w-3 h-3 text-amber-400" />
                      {interest}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Username Claim Prompt if empty */}
            {isSelf && !(userProfile as any)?.username && (
              <div className="p-6 bg-purple-500/10 border border-purple-500/20 rounded-3xl space-y-3">
                <h3 className="text-xs font-bold text-purple-300 uppercase font-mono flex items-center gap-1.5">
                  <AtSign className="w-4 h-4 text-purple-400" />
                  <span>Claim Unique Campus Username</span>
                </h3>
                <form onSubmit={handleClaimUsername} className="flex gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Choose username (e.g. rahul_29)..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    type="submit"
                    disabled={claiming}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs rounded-2xl"
                  >
                    Claim
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
