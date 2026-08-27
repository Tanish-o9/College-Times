import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getGroupById } from '../../services/groupService';
import {
  transferGroupOwnership,
  archiveGroup,
} from '../../services/groupManagementService';
import {
  getGroupNotificationPreferences,
  updateGroupNotificationPreferences,
  muteGroupNotifications,
  unmuteGroupNotifications,
  type GroupNotificationPreferences,
} from '../../services/groupNotificationPreferenceService';
import { canEditSettings, canTransferOwnership, canArchiveGroup } from '../../services/groupPermissionService';
import type { CampusGroup, GroupRole } from '../../types/group';
import { GroupInviteManager } from './GroupInviteManager';
import {
  ArrowLeft,
  Settings,
  ShieldAlert,
  Crown,
  Archive,
  RefreshCw,
  Save,
  Bell,
  BellOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const GroupSettingsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<CampusGroup | null>(null);
  const [userRole, setUserRole] = useState<GroupRole>('member');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  // Notification Preferences State
  const [notifPrefs, setNotifPrefs] = useState<GroupNotificationPreferences | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Ownership transfer state
  const [newOwnerUid, setNewOwnerUid] = useState('');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const loadGroupAndRole = async () => {
    if (!groupId || !currentUser) return;
    setLoading(true);
    try {
      const g = await getGroupById(groupId);
      setGroup(g);
      if (g) {
        setName(g.name);
        setDescription(g.description || '');
        setCategory(g.category || 'General');
        setVisibility(g.visibility);
      }

      const memberRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
      const snap = await getDoc(memberRef);
      if (snap.exists()) {
        setUserRole(snap.data().role || 'member');
      }

      const prefs = await getGroupNotificationPreferences(currentUser.uid, groupId);
      setNotifPrefs(prefs);
      if (prefs.mutedUntil) {
        const muteTime = prefs.mutedUntil instanceof Date ? prefs.mutedUntil.getTime() : (prefs.mutedUntil as any).toMillis?.() || 0;
        setIsMuted(Date.now() < muteTime);
      }
    } catch (err) {
      toast.error('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroupAndRole();
  }, [groupId, currentUser]);

  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !currentUser || saving) return;

    setSaving(true);
    try {
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        name: name.trim().slice(0, 80),
        description: description.trim().slice(0, 500),
        category,
        visibility,
      });
      toast.success('Group settings updated!');
      setGroup((prev) => (prev ? { ...prev, name, description, category, visibility } : null));
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotifPref = async (key: keyof GroupNotificationPreferences) => {
    if (!groupId || !currentUser || !notifPrefs) return;

    const newValue = !notifPrefs[key];
    const updated = { ...notifPrefs, [key]: newValue };
    setNotifPrefs(updated);

    try {
      await updateGroupNotificationPreferences(currentUser.uid, groupId, { [key]: newValue });
      toast.success('Notification preferences updated.');
    } catch (err) {
      toast.error('Failed to update notification preferences.');
    }
  };

  const handleMuteToggle = async (durationMinutes: number) => {
    if (!groupId || !currentUser) return;
    try {
      if (isMuted) {
        await unmuteGroupNotifications(currentUser.uid, groupId);
        setIsMuted(false);
        toast.success('Group notifications unmuted.');
      } else {
        await muteGroupNotifications(currentUser.uid, groupId, durationMinutes);
        setIsMuted(true);
        toast.success(`Group notifications muted for ${durationMinutes} minutes.`);
      }
    } catch (err) {
      toast.error('Failed to update mute state.');
    }
  };

  const handleTransferOwnershipSubmit = async () => {
    if (!groupId || !currentUser || !newOwnerUid.trim()) return;

    try {
      await transferGroupOwnership(groupId, newOwnerUid.trim(), currentUser, userProfile);
      toast.success('Group ownership transferred!');
      setIsTransferModalOpen(false);
      loadGroupAndRole();
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed.');
    }
  };

  const handleArchive = async () => {
    if (!groupId || !currentUser) return;
    if (!window.confirm('Are you sure you want to archive this campus group? It will become read-only.')) return;

    try {
      await archiveGroup(groupId, currentUser, userProfile);
      toast.success('Campus group archived.');
      navigate(`/groups/${groupId}`);
    } catch (err: any) {
      toast.error('Failed to archive group.');
    }
  };

  const canEdit = canEditSettings(userRole, userProfile?.role);
  const canTransfer = canTransferOwnership(userRole, userProfile?.role);
  const canArchive = canArchiveGroup(userRole, userProfile?.role);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(`/groups/${groupId}`)}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white truncate">
              {group?.name || 'Group Settings'}
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Administration & Notification Controls</p>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading group settings...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Notification Preferences Section */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-400" />
                  <span>My Group Notification Controls</span>
                </h2>
                <button
                  onClick={() => handleMuteToggle(60)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isMuted
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {isMuted ? <BellOff className="w-3.5 h-3.5 text-rose-400" /> : <Bell className="w-3.5 h-3.5 text-sky-400" />}
                  <span>{isMuted ? 'Unmute Group' : 'Mute for 1 Hour'}</span>
                </button>
              </div>

              {notifPrefs && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer">
                    <span className="text-slate-300 font-semibold">Mentions</span>
                    <input
                      type="checkbox"
                      checked={notifPrefs.mentions}
                      onChange={() => handleToggleNotifPref('mentions')}
                      className="accent-sky-500 w-4 h-4 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer">
                    <span className="text-slate-300 font-semibold">Chat Messages</span>
                    <input
                      type="checkbox"
                      checked={notifPrefs.chatMessages}
                      onChange={() => handleToggleNotifPref('chatMessages')}
                      className="accent-sky-500 w-4 h-4 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer">
                    <span className="text-slate-300 font-semibold">New Group Moments</span>
                    <input
                      type="checkbox"
                      checked={notifPrefs.newMoments}
                      onChange={() => handleToggleNotifPref('newMoments')}
                      className="accent-sky-500 w-4 h-4 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer">
                    <span className="text-slate-300 font-semibold">Polls & Results</span>
                    <input
                      type="checkbox"
                      checked={notifPrefs.polls}
                      onChange={() => handleToggleNotifPref('polls')}
                      className="accent-sky-500 w-4 h-4 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer">
                    <span className="text-slate-300 font-semibold">Events & RSVP</span>
                    <input
                      type="checkbox"
                      checked={notifPrefs.events}
                      onChange={() => handleToggleNotifPref('events')}
                      className="accent-sky-500 w-4 h-4 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer">
                    <span className="text-slate-300 font-semibold">Announcements</span>
                    <input
                      type="checkbox"
                      checked={notifPrefs.announcements}
                      onChange={() => handleToggleNotifPref('announcements')}
                      className="accent-sky-500 w-4 h-4 rounded"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* General Settings */}
            {canEdit && (
              <form onSubmit={handleSaveGeneralSettings} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-sky-400" />
                  <span>General Group Settings</span>
                </h2>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Group Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500/50"
                    >
                      <option value="General">General</option>
                      <option value="Coding">Coding & Tech</option>
                      <option value="Robotics">Robotics & Hardware</option>
                      <option value="Cultural">Cultural & Arts</option>
                      <option value="Sports">Sports & Fitness</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Visibility</label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500/50"
                    >
                      <option value="public">Public (Discoverable & open)</option>
                      <option value="private">Private (Join via Pass Code or Request)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save General Settings</span>
                </button>
              </form>
            )}

            {/* Invite Pass Management */}
            {group && canEdit && (
              <GroupInviteManager
                group={group}
                onGroupUpdated={(updated) => setGroup(updated)}
              />
            )}

            {/* Danger Zone: Transfer & Archive */}
            {canEdit && (
              <div className="p-6 bg-slate-900 border border-rose-500/20 rounded-3xl space-y-4">
                <h2 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Administrative Controls & Danger Zone</span>
                </h2>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  {canTransfer && (
                    <div>
                      <h3 className="text-xs font-bold text-white">Transfer Group Ownership</h3>
                      <p className="text-[11px] text-slate-400">Transfer owner role to another admin member.</p>
                      <button
                        onClick={() => setIsTransferModalOpen(true)}
                        className="mt-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Crown className="w-4 h-4" />
                        <span>Transfer Ownership</span>
                      </button>
                    </div>
                  )}

                  {canArchive && (
                    <div>
                      <h3 className="text-xs font-bold text-white">Archive Campus Group</h3>
                      <p className="text-[11px] text-slate-400">Make group read-only and hide from active creation.</p>
                      <button
                        onClick={handleArchive}
                        className="mt-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Archive className="w-4 h-4" />
                        <span>Archive Group</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Ownership Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              <span>Transfer Ownership</span>
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Enter the target user's UID to transfer group ownership. You will be demoted to an Admin.
            </p>
            <input
              type="text"
              value={newOwnerUid}
              onChange={(e) => setNewOwnerUid(e.target.value)}
              placeholder="Target User UID..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferOwnershipSubmit}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
