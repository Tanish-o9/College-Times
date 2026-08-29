import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Opportunity } from '../../types/opportunity';
import { useAuth } from '../../hooks/useAuth';
import { toggleSaveOpportunity, hasUserSavedOpportunity } from '../../services/opportunitySaveService';
import { toggleOpportunityReminder, hasUserOpportunityReminder } from '../../services/opportunityReminderService';
import { trackApplicationStatus, getUserApplicationStatus } from '../../services/opportunityApplicationService';
import { deleteOpportunity, reportOpportunity } from '../../services/opportunityService';
import toast from 'react-hot-toast';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  Bookmark, 
  Bell, 
  BellOff, 
  ExternalLink, 
  CheckCircle2, 
  ShieldCheck, 
  MessageCircle,
  Briefcase,
  Award,
  Edit,
  Trash2,
  Flag,
  X,
  RefreshCw,
} from 'lucide-react';
import { CreateOpportunityModal } from './CreateOpportunityModal';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onOpportunityUpdated?: (id: string) => void;
  onOpportunityDeleted?: (id: string) => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({ 
  opportunity,
  onOpportunityUpdated,
  onOpportunityDeleted
}) => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [saved, setSaved] = useState<boolean>(false);
  const [saveCount, setSaveCount] = useState<number>(opportunity.saveCount || 0);
  const [togglingSave, setTogglingSave] = useState<boolean>(false);

  const [hasReminder, setHasReminder] = useState<boolean>(false);
  const [togglingReminder, setTogglingReminder] = useState<boolean>(false);

  const [userAppStatus, setUserAppStatus] = useState<string | null>(null);

  // Edit / Report states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!opportunity.id || !currentUser) return;
    let mounted = true;

    Promise.all([
      hasUserSavedOpportunity(opportunity.id, currentUser.uid),
      hasUserOpportunityReminder(opportunity.id, currentUser.uid),
      getUserApplicationStatus(currentUser.uid, opportunity.id),
    ]).then(([savedVal, remVal, appVal]) => {
      if (mounted) {
        setSaved(savedVal);
        setHasReminder(remVal);
        if (appVal) setUserAppStatus(appVal);
      }
    });

    return () => {
      mounted = false;
    };
  }, [opportunity.id, currentUser]);

  const handleSaveToggle = async () => {
    if (!currentUser || !opportunity.id || togglingSave) return;
    setTogglingSave(true);
    try {
      const active = await toggleSaveOpportunity(opportunity.id, currentUser);
      setSaved(active);
      setSaveCount((prev) => (active ? prev + 1 : Math.max(0, prev - 1)));
      toast.success(active ? 'Saved to opportunities!' : 'Unsaved opportunity.');
    } catch (err) {
      toast.error('Failed to save opportunity.');
    } finally {
      setTogglingSave(false);
    }
  };

  const handleReminderToggle = async () => {
    if (!currentUser || !opportunity.id || togglingReminder) return;
    setTogglingReminder(true);
    try {
      const active = await toggleOpportunityReminder(opportunity.id, currentUser, opportunity.title);
      setHasReminder(active);
      toast.success(active ? 'Deadline reminder enabled!' : 'Reminder disabled.');
    } catch (err) {
      toast.error('Failed to set reminder.');
    } finally {
      setTogglingReminder(false);
    }
  };

  const handleApplyClick = async () => {
    if (!currentUser || !opportunity.id) return;
    const targetUrl = opportunity.applicationUrl || opportunity.applicationLink;
    
    // Safety check on external link
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      toast.error('Unsafe or invalid application URL protocol.');
      return;
    }

    try {
      await trackApplicationStatus(
        currentUser.uid,
        opportunity.id,
        opportunity.title,
        opportunity.organizationName || opportunity.organization || 'AKGEC Opportunity',
        'applied'
      );
      setUserAppStatus('applied');
    } catch (err) {
      // Non-blocking status tracking
    }
    
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async () => {
    if (!currentUser || !opportunity.id) return;
    if (!window.confirm('Are you sure you want to delete this opportunity?')) return;
    try {
      const isAdmin = userProfile?.role === 'admin';
      await deleteOpportunity(opportunity.id, currentUser.uid, isAdmin);
      toast.success('Opportunity deleted successfully.');
      if (onOpportunityDeleted) onOpportunityDeleted(opportunity.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete opportunity.');
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !opportunity.id || !reportReason.trim() || reporting) return;
    setReporting(true);
    try {
      const res = await reportOpportunity(opportunity.id, currentUser.uid, reportReason);
      if (res.alreadyReported) {
        toast.error('You have already reported this opportunity.');
      } else {
        toast.success('Opportunity reported successfully.');
        setShowReportModal(false);
        setReportReason('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to report.');
    } finally {
      setReporting(false);
    }
  };

  // Calculate Days Remaining
  const deadlineDate = opportunity.applicationDeadline
    ? typeof opportunity.applicationDeadline.toDate === 'function'
      ? opportunity.applicationDeadline.toDate()
      : new Date(opportunity.applicationDeadline)
    : new Date();

  const diffMs = deadlineDate.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isClosingSoon = diffDays > 0 && diffDays <= 3;
  const isExpired = diffMs <= 0;

  const isCreatorOrAdmin = currentUser?.uid === opportunity.createdBy || userProfile?.role === 'admin';

  return (
    <article className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden transition-all hover:border-slate-700">
      {/* Header Badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full text-xs font-bold flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5" />
            <span>{opportunity.type}</span>
          </span>

          <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-md text-[10px] font-bold uppercase">
            {opportunity.mode || opportunity.workMode || 'remote'}
          </span>

          {opportunity.isOfficial && (
            <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-[10px] font-bold">
              OFFICIAL
            </span>
          )}

          {opportunity.isVerified && (
            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Verified</span>
            </span>
          )}
        </div>

        {/* Deadline Badge */}
        {isExpired ? (
          <span className="px-2.5 py-1 bg-slate-800 text-slate-500 rounded-lg text-[11px] font-bold">
            Closed
          </span>
        ) : isClosingSoon ? (
          <span className="px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-[11px] font-bold animate-pulse">
            Closes in {diffDays} {diffDays === 1 ? 'day' : 'days'}!
          </span>
        ) : (
          <span className="px-2.5 py-1 bg-slate-950 text-slate-400 border border-slate-800 rounded-lg text-[11px] font-medium flex items-center gap-1">
            <Calendar className="w-3 h-3 text-purple-400" />
            <span>{deadlineDate.toLocaleDateString()}</span>
          </span>
        )}
      </div>

      {/* Org Name & Title */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Building2 className="w-4 h-4 text-purple-400" />
          <span>{opportunity.organizationName || opportunity.organization}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-white tracking-tight leading-snug">
            {opportunity.title}
          </h3>
          
          <div className="flex items-center gap-1.5">
            {isCreatorOrAdmin && (
              <>
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 hover:text-sky-400 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {!isCreatorOrAdmin && currentUser && (
              <button
                onClick={() => setShowReportModal(true)}
                className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                title="Report"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">
        {opportunity.description}
      </p>

      {/* Stipend / Location / Eligibility */}
      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs text-slate-400">
        <span className="flex items-center gap-1 truncate">
          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{opportunity.location || 'Campus / Remote'}</span>
        </span>

        {(opportunity.stipend || opportunity.salaryRange || opportunity.salary) && (
          <span className="flex items-center gap-1 truncate font-mono font-bold text-emerald-400">
            <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{opportunity.stipend || opportunity.salaryRange || opportunity.salary}</span>
          </span>
        )}
      </div>

      {/* Skills Tags */}
      {opportunity.skills && opportunity.skills.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {opportunity.skills.slice(0, 4).map((s: string) => (
            <span key={s} className="px-2 py-0.5 bg-slate-950 text-slate-400 border border-slate-800 rounded-md text-[10px] font-medium">
              #{s}
            </span>
          ))}
        </div>
      )}

      {/* Footer Controls */}
      <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Save & Reminder Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveToggle}
            disabled={togglingSave}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
              saved
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
            }`}
            title={saved ? 'Saved' : 'Save Opportunity'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${saved ? 'text-purple-400 fill-purple-400' : ''}`} />
            <span className="text-[11px]">{saveCount}</span>
          </button>

          <button
            onClick={handleReminderToggle}
            disabled={togglingReminder}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
              hasReminder
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
            }`}
            title={hasReminder ? 'Reminder Active' : 'Set Deadline Reminder'}
          >
            {hasReminder ? <Bell className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Dynamic Apply & Chat Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/chat')}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl text-xs font-semibold"
            title="Discuss in Community Chat"
          >
            <MessageCircle className="w-4 h-4" />
          </button>

          <button
            onClick={handleApplyClick}
            disabled={isExpired}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all ${
              userAppStatus === 'applied'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : isExpired
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-purple-500/20'
            }`}
          >
            {userAppStatus === 'applied' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Applied ✓</span>
              </>
            ) : (
              <>
                <span>Apply Now</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Edit Opportunity Modal */}
      <CreateOpportunityModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        opportunity={opportunity}
        onOpportunityCreated={() => {
          if (onOpportunityUpdated) onOpportunityUpdated(opportunity.id);
        }}
      />

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-rose-550" />
                <span>Report Opportunity</span>
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReport} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Reason for report</label>
                <textarea
                  required
                  rows={3}
                  maxLength={300}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Explain why this opportunity violations guidelines (spam, fake listings, etc.)..."
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
                  <span>Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </article>
  );
};
