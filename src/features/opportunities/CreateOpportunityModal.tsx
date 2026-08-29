import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { createOpportunity, editOpportunity } from '../../services/opportunityService';
import type { OpportunityType, OpportunityMode, Opportunity } from '../../types/opportunity';
import toast from 'react-hot-toast';
import { Briefcase, RefreshCw, X, Plus } from 'lucide-react';

interface CreateOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpportunityCreated?: (opportunity: Opportunity) => void;
  opportunity?: Opportunity | null;
}

const TYPES: OpportunityType[] = [
  'Placement', 'Internship', 'Hackathon', 'Scholarship',
  'Competition', 'Research', 'Workshop', 'Certification',
  'Freelance', 'Part-time', 'Campus Drive', 'Other'
];

const MODES: OpportunityMode[] = ['online', 'offline', 'hybrid'];

export const CreateOpportunityModal: React.FC<CreateOpportunityModalProps> = ({
  isOpen,
  onClose,
  onOpportunityCreated,
  opportunity = null,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [title, setTitle] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [type, setType] = useState<OpportunityType>('Placement');
  const [mode, setMode] = useState<OpportunityMode>('online');
  const [description, setDescription] = useState<string>('');
  const [applicationUrl, setApplicationUrl] = useState<string>('');
  const [applicationDeadline, setApplicationDeadline] = useState<string>('');
  const [location, setLocation] = useState<string>('Campus / Remote');
  const [stipend, setStipend] = useState<string>('');
  const [eligibility, setEligibility] = useState<string>('');
  const [isOfficial, setIsOfficial] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(opportunity?.title || '');
      setOrgName(opportunity?.organizationName || opportunity?.organization || '');
      setType(opportunity?.type || 'Placement');
      const oppMode = opportunity?.mode || opportunity?.workMode || 'online';
      setMode(oppMode.toLowerCase() as OpportunityMode);
      setDescription(opportunity?.description || '');
      setApplicationUrl(opportunity?.applicationUrl || opportunity?.applicationLink || '');
      
      let deadStr = '';
      if (opportunity?.applicationDeadline) {
        try {
          const dateObj = typeof opportunity.applicationDeadline.toDate === 'function'
            ? opportunity.applicationDeadline.toDate()
            : new Date(opportunity.applicationDeadline);
          deadStr = dateObj.toISOString().split('T')[0];
        } catch {}
      }
      setApplicationDeadline(deadStr);
      setLocation(opportunity?.location || 'Campus / Remote');
      setStipend(opportunity?.stipend || opportunity?.salaryRange || opportunity?.salary || '');
      setEligibility(opportunity?.eligibility || '');
      setIsOfficial(opportunity?.isOfficial || false);
    }
  }, [isOpen, opportunity]);

  if (!isOpen) return null;
  const isAdmin = userProfile?.role === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('You must be logged in to post an opportunity.');
      return;
    }

    if (!title.trim() || !orgName.trim() || !applicationUrl.trim() || !applicationDeadline) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      if (opportunity) {
        await editOpportunity(
          opportunity.id,
          currentUser.uid,
          {
            title,
            description,
            organizationName: orgName,
            type,
            mode,
            location,
            stipend,
            eligibility,
            applicationUrl,
            applicationDeadline,
            isOfficial: isAdmin ? isOfficial : false,
          },
          isAdmin
        );
        toast.success('Opportunity updated successfully!');
      } else {
        const res = await createOpportunity(
          {
            title,
            description,
            organizationName: orgName,
            type,
            mode,
            applicationUrl,
            applicationDeadline,
            location,
            stipend,
            eligibility,
            isOfficial: isAdmin ? isOfficial : false,
          },
          currentUser,
          isAdmin
        );
        toast.success('Opportunity posted successfully! 🎯');
        if (onOpportunityCreated) onOpportunityCreated(res);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save opportunity.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-purple-400" />
            <span>Post Campus Opportunity</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Opportunity Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Software Engineer Intern - Summer 2026"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Organization Name *</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Google / Microsoft / Campus T&P"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Opportunity Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as OpportunityType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Mode *</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as OpportunityMode)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 capitalize"
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>{m.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Application Deadline *</label>
              <input
                type="date"
                value={applicationDeadline}
                onChange={(e) => setApplicationDeadline(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Application URL *</label>
            <input
              type="url"
              value={applicationUrl}
              onChange={(e) => setApplicationUrl(e.target.value)}
              placeholder="https://..."
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide role description, expectations, and selection process..."
              rows={3}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Stipend / Salary</label>
              <input
                type="text"
                value={stipend}
                onChange={(e) => setStipend(e.target.value)}
                placeholder="e.g. ₹45,000 / month or 12 LPA"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Location Area</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Campus / Noida / Remote"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Eligibility / Branches</label>
            <input
              type="text"
              value={eligibility}
              onChange={(e) => setEligibility(e.target.value)}
              placeholder="e.g. CSE / IT / ECE 2026 Batch"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {isAdmin && (
            <div className="pt-2">
              <label className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl cursor-pointer text-xs font-bold text-amber-300">
                <input
                  type="checkbox"
                  checked={isOfficial}
                  onChange={(e) => setIsOfficial(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span>Mark as Official College T&P Opportunity</span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Publish Opportunity</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
