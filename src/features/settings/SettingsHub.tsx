import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { NotificationPreferences } from '../notifications/NotificationPreferences';
import {
  User,
  Bell,
  Shield,
  Lock,
  Palette,
  Link as LinkIcon,
  Trash2,
  ChevronRight,
  Save,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

type SettingsTab = 'profile' | 'notifications' | 'privacy' | 'security' | 'appearance' | 'connected' | 'account';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'profile', label: 'Profile', icon: User, color: 'text-sky-400' },
  { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-amber-400' },
  { id: 'privacy', label: 'Privacy', icon: Shield, color: 'text-emerald-400' },
  { id: 'security', label: 'Security', icon: Lock, color: 'text-rose-400' },
  { id: 'appearance', label: 'Appearance', icon: Palette, color: 'text-purple-400' },
  { id: 'connected', label: 'Connected Accounts', icon: LinkIcon, color: 'text-indigo-400' },
  { id: 'account', label: 'Account', icon: Trash2, color: 'text-slate-400' },
];

export const SettingsHub: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>((tab as SettingsTab) || 'profile');

  // Profile form state
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [bio, setBio] = useState((userProfile as any)?.bio || '');
  const [department, setDepartment] = useState(userProfile?.department || '');
  const [batchYear, setBatchYear] = useState<string>(
    userProfile?.batchYear ? String(userProfile.batchYear) : ''
  );
  const [interests, setInterests] = useState<string>((userProfile as any)?.interests?.join(', ') || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Privacy Settings state
  const [isPrivate, setIsPrivate] = useState(userProfile?.profileVisibility === 'private');
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    if (tab) setActiveTab(tab as SettingsTab);
  }, [tab]);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBio((userProfile as any)?.bio || '');
      setDepartment(userProfile?.department || '');
      setBatchYear(userProfile?.batchYear ? String(userProfile.batchYear) : '');
      setInterests((userProfile as any)?.interests?.join(', ') || '');
      setIsPrivate(userProfile?.profileVisibility === 'private');
    }
  }, [userProfile]);

  const handleTabChange = (newTab: SettingsTab) => {
    setActiveTab(newTab);
    navigate(`/settings/${newTab}`, { replace: true });
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    if (!displayName.trim()) {
      toast.error('Display name is required.');
      return;
    }
    setSavingProfile(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const interestsList = interests
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await updateDoc(userRef, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        department: department.trim(),
        batchYear: batchYear ? parseInt(batchYear) : null,
        interests: interestsList,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      toast.success('Profile updated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePrivacy = async (newVal: boolean) => {
    if (!currentUser) return;
    setIsPrivate(newVal);
    setSavingPrivacy(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        profileVisibility: newVal ? 'private' : 'public',
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      toast.success(newVal ? 'Account visibility set to Private.' : 'Account visibility set to Public.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update privacy settings.');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Edit Profile</h2>
              <p className="text-xs text-slate-400 mt-1">Update your public campus identity</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/60"
                  placeholder="Your display name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={200}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/60 resize-none"
                  placeholder="Tell other students a little about yourself..."
                />
                <p className="text-[10px] text-slate-600 mt-1">{bio.length}/200</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    maxLength={60}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/60"
                    placeholder="e.g. Computer Science"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Batch Year</label>
                  <input
                    type="number"
                    value={batchYear}
                    onChange={(e) => setBatchYear(e.target.value)}
                    min={2018}
                    max={2030}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/60"
                    placeholder="e.g. 2025"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Interests</label>
                <input
                  type="text"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/60"
                  placeholder="Coding, Music, Sports (comma-separated)"
                />
                <p className="text-[10px] text-slate-600 mt-1">Separate interests with commas</p>
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm rounded-xl shadow-md shadow-sky-500/20 transition-all disabled:opacity-60"
            >
              {savingProfile ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Profile</span>
            </button>
          </div>
        );

      case 'notifications':
        return <NotificationPreferences />;

      case 'privacy':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Privacy Settings</h2>
              <p className="text-xs text-slate-400 mt-1">Control who can see your profile and activity</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="space-y-1 pr-4">
                  <span className="text-sm font-semibold text-slate-200 block">Private Account</span>
                  <span className="text-xs text-slate-500 block leading-relaxed">
                    When your account is private, only students you approve can follow you and view your connections.
                  </span>
                </div>
                <button
                  type="button"
                  disabled={savingPrivacy}
                  onClick={() => handleSavePrivacy(!isPrivate)}
                  className={`w-12 h-7 rounded-full p-1 transition-all ${
                    isPrivate ? 'bg-sky-500' : 'bg-slate-855 border border-slate-750'
                  } flex items-center shrink-0 cursor-pointer`}
                >
                  <div
                    className={`w-5 h-5 bg-slate-950 rounded-full shadow-md transition-all ${
                      isPrivate ? 'translate-x-5 bg-slate-950' : 'translate-x-0 bg-slate-400'
                    }`}
                  />
                </button>
              </div>

              {[
                { label: 'Show profile in search results', key: 'searchVisible' },
                { label: 'Allow others to view my groups', key: 'groupsVisible' },
                { label: 'Show my activity in the campus feed', key: 'activityVisible' },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl opacity-60 pointer-events-none"
                >
                  <span className="text-sm text-slate-400">{item.label}</span>
                  <div className="w-12 h-7 bg-emerald-500/20 border border-emerald-500/30 rounded-full p-1 flex items-center">
                    <div className="w-5 h-5 bg-emerald-400 rounded-full translate-x-5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Security</h2>
              <p className="text-xs text-slate-400 mt-1">Manage your account security and login methods</p>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <p className="text-xs text-slate-400">Logged in as</p>
              <p className="text-sm font-bold text-white">
                {currentUser?.email || currentUser?.phoneNumber || 'Campus Student'}
              </p>
              <span className="inline-block px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold">
                Active Session
              </span>
            </div>
            <div className="p-4 bg-sky-500/5 border border-sky-500/20 rounded-2xl text-xs text-sky-300">
              Your account is secured with Firebase Authentication. Phone and Google sign-in are supported.
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Appearance</h2>
              <p className="text-xs text-slate-400 mt-1">Choose how the app looks for you</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['Dark Mode', 'System Default'].map((mode) => (
                <button
                  key={mode}
                  className={`p-4 rounded-2xl border text-sm font-semibold text-left transition-all ${
                    mode === 'Dark Mode'
                      ? 'bg-slate-900 border-sky-500/40 text-sky-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {mode}
                  {mode === 'Dark Mode' && (
                    <span className="ml-2 px-1.5 py-0.5 bg-sky-500/10 text-sky-400 rounded-full text-[9px]">
                      Active
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );

      case 'connected':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Connected Accounts</h2>
              <p className="text-xs text-slate-400 mt-1">Manage your linked sign-in providers</p>
            </div>
            <div className="space-y-3">
              {[
                { provider: 'Google Account', linked: !!currentUser?.email, color: 'text-red-400' },
                { provider: 'Phone Number', linked: !!currentUser?.phoneNumber, color: 'text-emerald-400' },
              ].map((item) => (
                <div
                  key={item.provider}
                  className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{item.provider}</p>
                    <p className={`text-[11px] font-medium mt-0.5 ${item.linked ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {item.linked ? 'Connected' : 'Not connected'}
                    </p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${item.linked ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                </div>
              ))}
            </div>
          </div>
        );

      case 'account':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Account</h2>
              <p className="text-xs text-slate-400 mt-1">Manage your campus account</p>
            </div>
            <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-rose-300">Danger Zone</h3>
              <p className="text-xs text-slate-400">
                These actions are irreversible. Please contact campus admin support if you need account deletion or data export.
              </p>
              <a
                href="mailto:support@collegstimes.com"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Request Account Deletion
              </a>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight">Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Manage your profile, notifications, and account preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <nav className="md:w-56 shrink-0">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${
                    isActive
                      ? 'bg-slate-800/80 text-white border-l-2 border-sky-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-l-2 border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? t.color : ''}`} />
                  <span className="text-sm font-semibold">{t.label}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ml-auto shrink-0 opacity-50 ${isActive ? 'opacity-100' : ''}`} />
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab Content */}
        <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 min-h-[400px]">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};
