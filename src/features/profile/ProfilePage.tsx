import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { BackButton } from '../../components/BackButton';
import {
  getRelationshipStatus,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriends,
  type RelationshipStatus
} from '../../services/friendService';
import { blockUser, unblockUser, isUserBlocked } from '../../services/directMessageService';
import { getMutualFriendsCount } from '../../services/mutualFriendsService';
import { createReport } from '../../services/reportService';
import { getUserAchievements } from '../../services/achievementService';
import { getUserGroupIds, getGroupById } from '../../services/groupService';
import { getSavedListings } from '../../services/marketplaceService';
import { getSavedOpportunities } from '../../services/opportunitySaveService';
import type { UserProfile2 } from '../../types/profile';
import type { Post } from '../../types/models';
import type { CampusGroup } from '../../types/group';
import type { MarketplaceListing } from '../../types/marketplace';
import type { Opportunity } from '../../types/opportunity';
import {
  UserCheck,
  UserPlus,
  MessageSquare,
  RefreshCw,
  Settings,
  GraduationCap,
  Hash,
  Lock,
  Flag,
  Ban,
  Award,
  Users as UsersIcon,
  Newspaper,
  Bookmark,
  ChevronRight,
  ShieldAlert,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const calculateProfileCompletion = (profile: any) => {
  if (!profile) return 0;
  const fields = ['displayName', 'photoURL', 'bio', 'department', 'batchYear', 'phone', 'email'];
  let filled = 0;
  fields.forEach(f => {
    if (profile[f] !== undefined && profile[f] !== null && profile[f] !== '') {
      filled++;
    }
  });
  return Math.round((filled / fields.length) * 100);
};

export const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile2 | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>('NONE');
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  // Tabs
  type ProfileTab = 'posts' | 'friends' | 'groups' | 'achievements' | 'saved';
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as ProfileTab) || 'posts';
  const setActiveTab = (tab: ProfileTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  // Tab Data States
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendsList, setFriendsList] = useState<{ uid: string; displayName: string; photoURL?: string }[]>([]);
  const [groups, setGroups] = useState<CampusGroup[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  const [mutualFriendsCount, setMutualFriendsCount] = useState<number>(0);
  
  // Saved data states (only for self)
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedListings, setSavedListings] = useState<MarketplaceListing[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<Opportunity[]>([]);

  // Report User Modal state
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>('');
  const [reportDescription, setReportDescription] = useState<string>('');
  const [reporting, setReporting] = useState<boolean>(false);

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
        targetUid = cleanName;
      }

      const userDocRef = doc(db, 'users', targetUid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const profData: UserProfile2 = {
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
          reputationPoints: data.reputationPoints || 0,
          level: data.level || 1,
          badges: data.badges || ['Campus Novice'],
        } as any;
        // Add extra privacy fields loaded from db
        (profData as any).friendListVisibility = data.friendListVisibility || 'public';
        (profData as any).postVisibility = data.postVisibility || 'public';
        (profData as any).storyVisibility = data.storyVisibility || 'public';
        (profData as any).messagePermissions = data.messagePermissions || 'everyone';

        setProfile(profData);

        if (currentUser && currentUser.uid !== targetUid) {
          const [relStatus, blockedVal, mCount] = await Promise.all([
            getRelationshipStatus(currentUser.uid, targetUid),
            isUserBlocked(currentUser.uid, targetUid),
            getMutualFriendsCount(currentUser.uid, targetUid),
          ]);
          setRelationshipStatus(relStatus);
          setIsBlocked(blockedVal);
          setMutualFriendsCount(mCount);
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

  // Load Tab Data dynamically
  useEffect(() => {
    if (!profile) return;
    const isSelf = currentUser && currentUser.uid === profile.uid;
    const isFriend = relationshipStatus === 'FRIENDS';

    // Privacy gates for loading data
    const canViewContent = isSelf || profile.profileVisibility === 'public' || isFriend;

    if (activeTab === 'posts' && canViewContent) {
      const showPosts = isSelf || (profile as any).postVisibility === 'public' || isFriend;
      if (showPosts) {
        const fetchPosts = async () => {
          const colRef = collection(db, 'posts');
          const q = query(
            colRef,
            where('authorId', '==', profile.uid),
            where('status', '==', 'active'),
            orderBy('timestamp', 'desc'),
            limit(30)
          );
          const snap = await getDocs(q);
          // filter out group posts
          setPosts(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() } as Post))
              .filter((p) => !p.groupId)
          );
        };
        fetchPosts().catch(console.error);
      } else {
        setPosts([]);
      }
    }

    if (activeTab === 'friends' && canViewContent) {
      const showFriends = isSelf || (profile as any).friendListVisibility === 'public' || ((profile as any).friendListVisibility === 'friends' && isFriend);
      if (showFriends) {
        const fetchFriends = async () => {
          const res = await getFriends(profile.uid, 50);
          const details = await Promise.all(
            res.uids.map(async (fuid) => {
              const uSnap = await getDoc(doc(db, 'users', fuid));
              if (uSnap.exists()) {
                const uData = uSnap.data();
                return {
                  uid: fuid,
                  displayName: uData.displayName || 'Student',
                  photoURL: uData.photoURL,
                };
              }
              return { uid: fuid, displayName: 'Campus Student' };
            })
          );
          setFriendsList(details);
        };
        fetchFriends().catch(console.error);
      } else {
        setFriendsList([]);
      }
    }

    if (activeTab === 'groups' && canViewContent) {
      const fetchGroups = async () => {
        const ids = await getUserGroupIds(profile.uid);
        const list = await Promise.all(ids.map((gid) => getGroupById(gid)));
        setGroups(list.filter((g): g is CampusGroup => g !== null && g.active));
      };
      fetchGroups().catch(console.error);
    }

    if (activeTab === 'achievements') {
      getUserAchievements(profile.uid).then(setBadges).catch(console.error);
    }

    if (activeTab === 'saved' && isSelf) {
      const fetchSaved = async () => {
        // Saved Posts
        const savedPostsRef = collection(db, 'users', profile.uid, 'savedPosts');
        const postsSnap = await getDocs(savedPostsRef);
        const postIds = postsSnap.docs.map((d) => d.id);
        const pDetails = await Promise.all(
          postIds.map(async (pid) => {
            const snap = await getDoc(doc(db, 'posts', pid));
            return snap.exists() ? ({ id: snap.id, ...snap.data() } as Post) : null;
          })
        );
        setSavedPosts(pDetails.filter((p): p is Post => p !== null));

        // Saved Listings & Opportunities
        const [listingsList, oppsList] = await Promise.all([
          getSavedListings(currentUser!),
          getSavedOpportunities(currentUser!),
        ]);
        setSavedListings(listingsList);
        setSavedOpportunities(oppsList);
      };
      fetchSaved().catch(console.error);
    }
  }, [activeTab, profile, relationshipStatus, currentUser]);

  const handleRelationshipAction = async () => {
    if (!profile || !currentUser || actionBusy) return;
    setActionBusy(true);
    try {
      if (relationshipStatus === 'NONE') {
        const isPending = await sendFriendRequest(currentUser.uid, profile.uid);
        setRelationshipStatus(isPending ? 'FRIENDS' : 'OUTGOING_PENDING');
        if (isPending) {
          setProfile((prev) => (prev ? { ...prev, followersCount: prev.followersCount + 1 } : null));
          toast.success(`You are now friends with @${profile.username}! 🎉`);
        } else {
          toast.success(`Friend request sent to @${profile.username}`);
        }
      } else if (relationshipStatus === 'OUTGOING_PENDING') {
        await cancelFriendRequest(currentUser.uid, profile.uid);
        setRelationshipStatus('NONE');
        toast.success(`Cancelled friend request to @${profile.username}`);
      } else if (relationshipStatus === 'INCOMING_PENDING') {
        await acceptFriendRequest(currentUser.uid, profile.uid);
        setRelationshipStatus('FRIENDS');
        setProfile((prev) => (prev ? { ...prev, followersCount: prev.followersCount + 1 } : null));
        toast.success(`You are now friends with @${profile.username}! 🎉`);
      } else if (relationshipStatus === 'FRIENDS') {
        const confirm = window.confirm(`Are you sure you want to remove @${profile.username} from your friends?`);
        if (confirm) {
          await removeFriend(currentUser.uid, profile.uid);
          setRelationshipStatus('NONE');
          setProfile((prev) => (prev ? { ...prev, followersCount: Math.max(0, prev.followersCount - 1) } : null));
          toast.success(`Removed @${profile.username} from friends`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleBlockAction = async () => {
    if (!profile || !currentUser || actionBusy) return;
    setActionBusy(true);
    try {
      if (isBlocked) {
        await unblockUser(profile.uid, currentUser);
        setIsBlocked(false);
        toast.success(`Unblocked @${profile.username}`);
      } else {
        const confirm = window.confirm(`Are you sure you want to block @${profile.username}? You will not be able to exchange messages or friend requests.`);
        if (confirm) {
          await blockUser(profile.uid, profile.displayName, currentUser);
          setIsBlocked(true);
          setRelationshipStatus('NONE'); // Remove relationships
          toast.success(`Blocked @${profile.username}`);
        }
      }
    } catch (err: any) {
      toast.error('Block operation failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReportUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !currentUser || !reportReason.trim() || reporting) return;
    setReporting(true);
    try {
      await createReport(
        currentUser.uid,
        profile.uid,
        'user',
        reportReason,
        reportDescription
      );
      toast.success(`Report submitted. Administrators will review @${profile.username}'s account.`);
      setShowReportModal(false);
      setReportReason('');
      setReportDescription('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report.');
    } finally {
      setReporting(false);
    }
  };

  const isSelf = currentUser && profile && currentUser.uid === profile.uid;
  const isFriend = relationshipStatus === 'FRIENDS';
  const isProfilePrivate = profile && profile.profileVisibility === 'private' && !isSelf && !isFriend;
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton customFallback="/discover" />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white">
              {profile ? profile.displayName : 'Campus Profile'}
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">@{profile?.username || 'user'}</p>
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
            <p className="text-slate-400 text-xs">Profile not found or suspended.</p>
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-sky-500 text-slate-950 font-bold text-xs rounded-xl">
              Back to Home
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-200">
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
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Settings className="w-4 h-4 text-sky-400" />
                      <span>Edit Profile</span>
                    </button>
                  ) : currentUser && (
                    <>
                      {/* Block status */}
                      <button
                        onClick={handleBlockAction}
                        disabled={actionBusy}
                        className={`px-3 py-2 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isBlocked
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            : 'bg-slate-800 hover:bg-rose-500/10 border-slate-700 text-slate-400 hover:text-rose-400'
                        }`}
                        title={isBlocked ? 'Unblock User' : 'Block User'}
                      >
                        <Ban className="w-4 h-4" />
                        <span>{isBlocked ? 'Blocked' : 'Block'}</span>
                      </button>

                      {/* Relationship buttons (hide if blocked) */}
                      {!isBlocked && (
                        <>
                          {relationshipStatus === 'INCOMING_PENDING' ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={handleRelationshipAction}
                                disabled={actionBusy}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1"
                              >
                                Accept
                              </button>
                              <button
                                onClick={async () => {
                                  if (actionBusy) return;
                                  setActionBusy(true);
                                  try {
                                    await declineFriendRequest(currentUser.uid, profile.uid);
                                    setRelationshipStatus('NONE');
                                    toast.success('Friend request declined.');
                                  } catch (err: any) {
                                    toast.error('Action failed.');
                                  } finally {
                                    setActionBusy(false);
                                  }
                                }}
                                disabled={actionBusy}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={handleRelationshipAction}
                              disabled={actionBusy}
                              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                                relationshipStatus === 'FRIENDS'
                                  ? 'bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700'
                                  : relationshipStatus === 'OUTGOING_PENDING'
                                    ? 'bg-slate-800 text-slate-400 border border-slate-755'
                                    : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                              }`}
                            >
                              {actionBusy ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : relationshipStatus === 'FRIENDS' ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Friends</span>
                                </>
                              ) : relationshipStatus === 'OUTGOING_PENDING' ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                                  <span>Requested</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>Add Friend</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Message button */}
                          {(profile.profileVisibility === 'public' || isFriend) && (
                            <button
                              onClick={() => {
                                import('../../services/directMessageService').then(({ getOrCreateConversation }) => {
                                  getOrCreateConversation(profile.uid, currentUser!, profile.displayName)
                                    .then((conv) => navigate(`/messages/${conv.id}`))
                                    .catch(() => navigate('/messages'));
                                });
                              }}
                              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                              <span>Message</span>
                            </button>
                          )}
                        </>
                      )}

                      {/* Report button */}
                      <button
                        onClick={() => setShowReportModal(true)}
                        className="p-2 bg-slate-800 hover:bg-rose-550/10 border border-slate-700 text-slate-400 hover:text-rose-400 rounded-xl"
                        title="Report User"
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Stats Strip */}
              <div className="flex items-center gap-8 pt-4 border-t border-slate-800 text-xs font-mono flex-wrap">
                <div>
                  <span className="font-bold text-white text-sm">{profile.followersCount || 0}</span>
                  <span className="text-slate-400 ml-1.5">Friends</span>
                </div>
                <div>
                  <span className="font-bold text-purple-400 text-sm">Lvl {(profile as any).level || 1}</span>
                  <span className="text-slate-400 ml-1.5">({(profile as any).reputationPoints || 0} XP)</span>
                </div>
                {!isSelf && mutualFriendsCount > 0 && (
                  <div>
                    <span className="font-bold text-sky-400 text-sm">{mutualFriendsCount}</span>
                    <span className="text-slate-400 ml-1.5">Mutual Friends</span>
                  </div>
                )}
              </div>

              {/* Department / Batch */}
              {(profile.department || profile.batchYear) && (
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
                </div>
              )}

              {/* Profile Completion Bar for Owner */}
              {isSelf && (
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Profile Completion Progress</span>
                    <span className="font-bold text-sky-400">{calculateProfileCompletion(profile)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-500"
                      style={{ width: `${calculateProfileCompletion(profile)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Profile Content / Tab panel */}
            {isProfilePrivate ? (
              /* Privacy gated placeholder */
              <div className="p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
                  <Lock className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">This Account is Private</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Add @{profile.username} as a friend to view their posts, friends, groups, and achievements.
                  </p>
                </div>
              </div>
            ) : (
              /* Normal Tab Layout */
              <div className="space-y-4">
                {/* Tab buttons */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
                  {[
                    { id: 'posts', label: 'Posts', icon: Newspaper },
                    { id: 'friends', label: 'Friends', icon: UserCheck },
                    { id: 'groups', label: 'Groups', icon: UsersIcon },
                    { id: 'achievements', label: 'Achievements', icon: Award },
                    ...(isSelf ? [{ id: 'saved', label: 'Saved', icon: Bookmark }] : []),
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all whitespace-nowrap ${
                          isActive
                            ? 'bg-sky-500/10 border-sky-500/40 text-sky-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tab content renders */}
                <div className="min-h-[200px]">
                  {activeTab === 'posts' && (
                    <div className="space-y-4">
                      {posts.length === 0 ? (
                        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
                          No posts published yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          {posts.map((post) => (
                            <div
                              key={post.id}
                              onClick={() => navigate(`/feed`)}
                              className="p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all cursor-pointer space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-800 text-sky-400">
                                  {post.category}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {post.timestamp ? new Date(post.timestamp.toMillis?.() || post.timestamp).toLocaleDateString() : ''}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-white">{post.title || 'Campus Post'}</h4>
                              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{post.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'friends' && (
                    <div>
                      {friendsList.length === 0 ? (
                        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
                          No connections visible.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {friendsList.map((f) => (
                            <div
                              key={f.uid}
                              onClick={() => navigate(`/profile/${f.uid}`)}
                              className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between cursor-pointer hover:border-slate-700 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                {f.photoURL ? (
                                  <img src={f.photoURL} alt={f.displayName} className="w-8 h-8 rounded-xl object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 font-bold text-xs">
                                    {f.displayName[0].toUpperCase()}
                                  </div>
                                )}
                                <span className="text-xs font-bold text-white">{f.displayName}</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'groups' && (
                    <div>
                      {groups.length === 0 ? (
                        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
                          No groups joined yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {groups.map((g) => (
                            <div
                              key={g.id}
                              onClick={() => navigate(`/groups/${g.id}`)}
                              className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between cursor-pointer hover:border-slate-700 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                {g.iconUrl ? (
                                  <img src={g.iconUrl} alt={g.name} className="w-8 h-8 rounded-xl object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-xs">
                                    {g.name[0].toUpperCase()}
                                  </div>
                                )}
                                <span className="text-xs font-bold text-white">{g.name}</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'achievements' && (
                    <div>
                      {badges.length === 0 ? (
                        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
                          No achievement badges unlocked yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {badges.map((badge) => (
                            <div
                              key={badge}
                              className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col items-center text-center space-y-2"
                            >
                              <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                <Award className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-bold text-white">{badge}</span>
                              <span className="text-[10px] text-slate-400 font-medium">Unlocked ✓</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'saved' && isSelf && (
                    <div className="space-y-6">
                      {/* Saved Feed Posts */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Bookmarked Feed Posts</h4>
                        {savedPosts.length === 0 ? (
                          <p className="text-xs text-slate-500 italic p-3 bg-slate-900/30 border border-slate-800 rounded-2xl">No saved feed posts.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {savedPosts.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => navigate(`/feed`)}
                                className="p-3 bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-2xl cursor-pointer flex items-center justify-between"
                              >
                                <div className="space-y-1">
                                  <span className="text-[9px] font-mono text-sky-400 uppercase font-bold">{p.category}</span>
                                  <h5 className="text-xs font-bold text-white truncate max-w-md">{p.title}</h5>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-600" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Saved Marketplace Listings */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Bookmarked Marketplace Items</h4>
                        {savedListings.length === 0 ? (
                          <p className="text-xs text-slate-500 italic p-3 bg-slate-900/30 border border-slate-800 rounded-2xl">No saved marketplace items.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {savedListings.map((l) => (
                              <div
                                key={l.id}
                                onClick={() => navigate(`/marketplace/${l.id}`)}
                                className="p-3 bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-2xl cursor-pointer flex items-center justify-between"
                              >
                                <div className="space-y-1">
                                  <span className="text-[9px] font-mono text-amber-400 uppercase font-bold">{l.category}</span>
                                  <h5 className="text-xs font-bold text-white truncate max-w-md">{l.title} (₹{l.price})</h5>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-600" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Saved Opportunities */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Bookmarked Opportunities</h4>
                        {savedOpportunities.length === 0 ? (
                          <p className="text-xs text-slate-500 italic p-3 bg-slate-900/30 border border-slate-800 rounded-2xl">No saved opportunities.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {savedOpportunities.map((o) => (
                              <div
                                key={o.id}
                                onClick={() => navigate(`/opportunities`)}
                                className="p-3 bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-2xl cursor-pointer flex items-center justify-between"
                              >
                                <div className="space-y-1">
                                  <span className="text-[9px] font-mono text-purple-400 uppercase font-bold">{o.type}</span>
                                  <h5 className="text-xs font-bold text-white truncate max-w-md">{o.title} • {o.organizationName || o.organization}</h5>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-600" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Report User Modal */}
      {showReportModal && profile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>Report User @{profile.username}</span>
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReportUser} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Reason for report</label>
                <select
                  required
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500/50"
                >
                  <option value="">Select a reason...</option>
                  <option value="harassment">Harassment or Bullying</option>
                  <option value="spam">Spam or Scamming</option>
                  <option value="inappropriate_profile">Inappropriate Profile Photo/Bio</option>
                  <option value="impersonation">Impersonation of another student</option>
                  <option value="other">Other Violation</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Detailed Description</label>
                <textarea
                  required
                  rows={3}
                  maxLength={300}
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Provide additional details or screenshots descriptions..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reporting}
                  className="flex-1 py-2 bg-rose-500 hover:bg-rose-450 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1"
                >
                  {reporting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
