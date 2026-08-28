import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { createGroup } from '../../services/groupService';
import type { CampusGroup, CampusGroupType } from '../../types/group';
import { X, Users, Plus, RefreshCw, Globe, Lock, Key } from 'lucide-react';
import toast from 'react-hot-toast';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (group: CampusGroup) => void;
}

const CATEGORIES = [
  'Clubs',
  'Batch',
  'Department',
  'Coding',
  'Sports',
  'Cultural',
  'Placement',
  'Academics',
  'Events',
  'Hostel',
  'Campus Life',
  'Other',
];

const DEPARTMENTS = [
  { id: 'cse', name: 'Computer Science & Engineering (CSE)' },
  { id: 'ece', name: 'Electronics & Communication (ECE)' },
  { id: 'it', name: 'Information Technology (IT)' },
  { id: 'aiml', name: 'AI & Machine Learning (AIML)' },
  { id: 'me', name: 'Mechanical Engineering (ME)' },
  { id: 'ce', name: 'Civil Engineering (CE)' },
];

const BATCHES = [2026, 2027, 2028, 2029, 2030];

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
}) => {
  const { currentUser, userProfile } = useAuth();
  useOverlayBackHandler(isOpen, onClose);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Clubs');
  const [groupType, setGroupType] = useState<CampusGroupType>('community');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [departmentId, setDepartmentId] = useState('');
  const [batchYear, setBatchYear] = useState<string>('');
  const [rules, setRules] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Group name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
      const created = await createGroup(
        {
          name: trimmedName,
          slug,
          description: description.trim(),
          category,
          type: category === 'Department' ? 'department' : category === 'Batch' ? 'batch' : groupType,
          visibility,
          rules: rules.trim(),
          ...(departmentId ? { departmentId } : {}),
          ...(batchYear ? { batchYear: Number(batchYear) } : {}),
          ...(iconUrl.trim() ? { iconUrl: iconUrl.trim() } : {}),
          passcode: passcode.trim(),
        },
        currentUser,
        userProfile
      );

      toast.success(`Group "${created.name}" created with pass code ${created.inviteCodePlaintext || 'generated'}!`);
      onGroupCreated?.(created);
      onClose();
      // Reset form
      setName('');
      setDescription('');
      setRules('');
      setDepartmentId('');
      setBatchYear('');
      setIconUrl('');
      setPasscode('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto p-6 space-y-5 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">Create Campus Community Group</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Group Name * (Max 80 chars)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              placeholder="e.g. Robotics & Embedded Systems Club"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Group Type
              </label>
              <select
                value={groupType}
                onChange={(e) => setGroupType(e.target.value as CampusGroupType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="community">Community / Club</option>
                <option value="department">Department Group</option>
                <option value="batch">Batch Group</option>
                <option value="campus">Campus-Wide</option>
              </select>
            </div>
          </div>

          {category === 'Department' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">Select Department (Optional)</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === 'Batch' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Graduation Batch
              </label>
              <select
                value={batchYear}
                onChange={(e) => setBatchYear(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">Select Graduation Year (Optional)</option>
                {BATCHES.map((year) => (
                  <option key={year} value={year}>
                    Batch {year}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Description (Max 500 chars)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Brief description of group activities, discussions, and focus areas..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Group Rules / Guidelines (Optional)
            </label>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value.slice(0, 1000))}
              placeholder="Conduct guidelines, posting rules, or contact info..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Group Visibility
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  visibility === 'public'
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>Public Group</span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  visibility === 'private'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Private (Pass Code)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {visibility === 'public'
                ? 'Public groups are discoverable and joinable by any campus student.'
                : 'Private groups require a unique CT invite pass code to join.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-sky-400" />
              <span>Group Password / Join Passcode (Optional)</span>
            </label>
            <input
              type="text"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\s+/g, ''))}
              placeholder="e.g. SECURE123 (Leave blank for no password)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              If set, students must enter this exact passcode to join the group. Leave blank to let anyone join instantly.
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Create Group</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
