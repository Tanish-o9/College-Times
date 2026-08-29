import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  submitFeedback,
  getUserFeedback,
  getAllFeedback,
  updateFeedbackStatus,
  type CampusFeedback,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackPriority
} from '../../services/feedbackService';
import { MessageSquare, RefreshCw, Send, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES: FeedbackCategory[] = [
  'Facility Suggestion',
  'Facility Complaint',
  'Platform Feedback',
  'Community Suggestion',
  'Other'
];

const PRIORITIES: FeedbackPriority[] = ['low', 'normal', 'high', 'urgent'];

export const FeedbackPlatform: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'submit' | 'history' | 'admin'>('submit');
  const [loading, setLoading] = useState<boolean>(true);
  const [feedbackList, setFeedbackList] = useState<CampusFeedback[]>([]);
  const [adminList, setAdminList] = useState<CampusFeedback[]>([]);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('Platform Feedback');
  const [priority, setPriority] = useState<FeedbackPriority>('normal');
  const [submitting, setSubmitting] = useState(false);

  // Admin Controls State
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'All'>('All');
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [adminResponseText, setAdminResponseText] = useState('');
  const [adminStatusSelect, setAdminStatusSelect] = useState<FeedbackStatus>('UNDER_REVIEW');

  const fetchUserData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const list = await getUserFeedback(currentUser.uid);
      setFeedbackList(list);
    } catch {
      toast.error('Failed to load your feedback history.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const list = await getAllFeedback(categoryFilter, statusFilter);
      setAdminList(list);
    } catch {
      toast.error('Failed to load campus feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchUserData();
    } else if (activeTab === 'admin') {
      fetchAdminData();
    }
  }, [activeTab, categoryFilter, statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting || !title.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      const authorName = userProfile?.displayName || currentUser.displayName || 'Anonymous Student';
      await submitFeedback(currentUser.uid, authorName, category, title, description, priority);
      toast.success('Feedback submitted successfully!');
      setTitle('');
      setDescription('');
      setCategory('Platform Feedback');
      setPriority('normal');
      setActiveTab('history');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (feedbackId: string) => {
    if (!currentUser || !isAdmin) return;
    try {
      await updateFeedbackStatus(feedbackId, adminStatusSelect, adminResponseText, currentUser.uid);
      toast.success('Status updated successfully!');
      setSelectedFeedbackId(null);
      setAdminResponseText('');
      fetchAdminData();
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const getStatusColor = (status: FeedbackStatus) => {
    switch (status) {
      case 'RESOLVED':
        return 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
      case 'IN_PROGRESS':
        return 'text-sky-400 bg-sky-950/20 border-sky-900/30';
      case 'UNDER_REVIEW':
        return 'text-amber-400 bg-amber-950/20 border-amber-900/30';
      case 'REJECTED':
        return 'text-rose-400 bg-rose-950/20 border-rose-900/30';
      default:
        return 'text-slate-400 bg-slate-950 border-slate-850';
    }
  };

  const getPriorityColor = (p: FeedbackPriority) => {
    switch (p) {
      case 'urgent':
        return 'text-rose-500 font-bold';
      case 'high':
        return 'text-amber-500 font-medium';
      case 'normal':
        return 'text-sky-500';
      default:
        return 'text-slate-500';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="relative p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <MessageSquare className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-white tracking-tight uppercase font-mono">Feedback Platform</h1>
          </div>
          <p className="text-xs text-slate-400">
            Submit facility complaints, suggestions, or platform bugs directly to campus administration.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-850">
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'submit' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Submit
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            My Cases
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'admin' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Admin Inbox
            </button>
          )}
        </div>
      </div>

      {/* Main Content Areas */}
      {activeTab === 'submit' && (
        <form onSubmit={handleSubmit} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">New Submission</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-350 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as FeedbackPriority)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-350 focus:outline-none"
              >
                {PRIORITIES.map((pri) => (
                  <option key={pri} value={pri}>
                    {pri.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Case Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Non-functional projector in Block-C Room 102"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Description / Details</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the complaint or suggestion in detail..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-850 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Feedback</span>
              </>
            )}
          </button>
        </form>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading cases...</div>
          ) : feedbackList.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs italic bg-slate-900 border border-slate-850 rounded-3xl">
              You haven't submitted any cases or feedback yet.
            </div>
          ) : (
            feedbackList.map((item) => (
              <div key={item.id} className="p-5 bg-slate-900 border border-slate-850 rounded-3xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-slate-950 border border-slate-850 text-slate-400 rounded-full font-mono text-[9px] font-bold">
                      {item.category}
                    </span>
                    <span className={`text-[9px] font-mono capitalize ${getPriorityColor(item.priority)}`}>
                      {item.priority} priority
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 border text-[9px] font-bold rounded-full font-mono ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white leading-snug">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>

                {item.adminResponse && (
                  <div className="p-3 bg-slate-950 border border-slate-850 rounded-2xl space-y-1">
                    <p className="text-[9px] font-bold text-sky-400 uppercase font-mono">Admin Official Response</p>
                    <p className="text-xs text-slate-350 leading-normal">{item.adminResponse}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'admin' && isAdmin && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-slate-900 border border-slate-850 rounded-3xl flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading cases...</div>
          ) : adminList.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs italic bg-slate-900 border border-slate-850 rounded-3xl">
              No matching feedback submissions found in queue.
            </div>
          ) : (
            adminList.map((item) => (
              <div key={item.id} className="p-5 bg-slate-900 border border-slate-850 rounded-3xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-slate-950 border border-slate-850 text-slate-400 rounded-full font-mono text-[9px] font-bold">
                      {item.category}
                    </span>
                    <span className={`text-[9px] font-mono capitalize ${getPriorityColor(item.priority)}`}>
                      {item.priority}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 border text-[9px] font-bold rounded-full font-mono ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white leading-snug">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                <p className="text-[10px] text-slate-500 font-mono">Submitted by: {item.authorName}</p>

                {item.adminResponse && (
                  <div className="p-3 bg-slate-950 border border-slate-850 rounded-2xl space-y-1">
                    <p className="text-[9px] font-bold text-sky-400 uppercase font-mono">Response Log</p>
                    <p className="text-xs text-slate-350 leading-normal">{item.adminResponse}</p>
                  </div>
                )}

                {selectedFeedbackId === item.id ? (
                  <div className="pt-3 border-t border-slate-850 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">Status</label>
                        <select
                          value={adminStatusSelect}
                          onChange={(e) => setAdminStatusSelect(e.target.value as FeedbackStatus)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="SUBMITTED">SUBMITTED</option>
                          <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="RESOLVED">RESOLVED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">Official Response</label>
                      <textarea
                        rows={2}
                        value={adminResponseText}
                        onChange={(e) => setAdminResponseText(e.target.value)}
                        placeholder="Write details or next action steps..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-650 focus:outline-none resize-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus(item.id!)}
                        className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs uppercase rounded-xl transition-all"
                      >
                        Apply Changes
                      </button>
                      <button
                        onClick={() => setSelectedFeedbackId(null)}
                        className="px-4 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white font-bold text-xs uppercase rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedFeedbackId(item.id!);
                      setAdminStatusSelect(item.status);
                      setAdminResponseText(item.adminResponse || '');
                    }}
                    className="px-3.5 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-800 text-sky-400 hover:text-sky-300 font-bold text-xs uppercase rounded-xl transition-all shadow-md"
                  >
                    Action / Respond
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
