import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  createSupportTicket,
  getUserSupportTickets,
  getAllSupportTickets,
  assignSupportTicket,
  updateSupportTicketStatus,
  addSupportTicketReply,
  getSupportTicketReplies,
  type SupportTicket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type TicketReply
} from '../../services/supportTicketService';
import { LifeBuoy, Plus, RefreshCw, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export const SupportCenter: React.FC = () => {
  const { currentUser, userProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'my_tickets' | 'admin_queue'>('my_tickets');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // New Ticket Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('Other');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [submitting, setSubmitting] = useState(false);

  // Selected Ticket Replies Thread State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      if (activeTab === 'admin_queue' && userProfile?.role === 'admin') {
        const list = await getAllSupportTickets();
        setTickets(list);
      } else {
        const list = await getUserSupportTickets(currentUser.uid);
        setTickets(list);
      }
    } catch {
      toast.error('Failed to load support workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, currentUser]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting || !title.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      const userName = userProfile?.displayName || currentUser.displayName || 'Campus Peer';
      await createSupportTicket(currentUser.uid, userName, {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
      });

      toast.success('Support ticket created successfully!');
      setTitle('');
      setDescription('');
      setShowAddForm(false);
      loadData();
    } catch {
      toast.error('Failed to submit support ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    try {
      const thread = await getSupportTicketReplies(ticket.id!);
      setReplies(thread);
    } catch {
      toast.error('Failed to load discussion replies.');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedTicket || sendingReply || !replyText.trim()) return;

    setSendingReply(true);
    try {
      const senderName = userProfile?.displayName || currentUser.displayName || 'Campus Peer';
      const senderRole = userProfile?.role === 'admin' ? 'admin' : 'user';

      // If user replies, notify assigned admin (if any); if admin replies, notify ticket creator
      const notifyId =
        senderRole === 'admin'
          ? selectedTicket.creatorId
          : selectedTicket.assignedAdminId || undefined;

      await addSupportTicketReply(
        selectedTicket.id!,
        replyText.trim(),
        currentUser.uid,
        senderName,
        senderRole,
        notifyId
      );

      setReplyText('');
      // Reload replies list
      const thread = await getSupportTicketReplies(selectedTicket.id!);
      setReplies(thread);
      toast.success('Response shared!');
    } catch {
      toast.error('Failed to reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleAssignToMe = async (ticketId: string) => {
    if (!currentUser || userProfile?.role !== 'admin') return;
    try {
      const adminName = userProfile?.displayName || currentUser.displayName || 'Admin Support';
      await assignSupportTicket(ticketId, currentUser.uid, adminName);
      toast.success('Ticket assigned to you!');
      loadData();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, assignedAdminId: currentUser.uid, assignedAdminName: adminName, status: 'ASSIGNED' } : null));
      }
    } catch {
      toast.error('Assignment failed.');
    }
  };

  const handleUpdateStatus = async (ticketId: string, nextStatus: TicketStatus, creatorId: string) => {
    if (userProfile?.role !== 'admin') return;
    try {
      await updateSupportTicketStatus(ticketId, nextStatus, creatorId);
      toast.success(`Ticket status updated to ${nextStatus}`);
      loadData();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch {
      toast.error('Status update failed.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="relative p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-455">
              <LifeBuoy className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-white tracking-tight uppercase font-mono">Help & Support Desk</h1>
          </div>
          <p className="text-xs text-slate-400">
            Log support tickets for hostel issues, administrative coordination, and technical assistance.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-455 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Ticket</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-300 rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('my_tickets')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              activeTab === 'my_tickets'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-455'
                : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200'
            }`}
          >
            My Tickets
          </button>

          {userProfile?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin_queue')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'admin_queue'
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                  : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200'
              }`}
            >
              Support Queue (Admin)
            </button>
          )}
        </div>
      </div>

      {/* Create Ticket Form */}
      {showAddForm && (
        <form onSubmit={handleCreateTicket} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">Log Help Desk Ticket</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Issue Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of the issue..."
                className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3 py-2 text-xs text-slate-350 focus:outline-none"
              >
                {['Academics', 'Hostel', 'Transport', 'Facilities', 'IT', 'Library', 'Administration', 'Other'].map((c) => (
                  <option key={c} value={c} className="bg-slate-950 text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Description / Details</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Elaborate details of what assistance is required..."
                className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Urgency Priority</label>
              <div className="flex flex-col gap-2">
                {['low', 'medium', 'high', 'critical'].map((p) => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                    <input
                      type="radio"
                      name="priority"
                      checked={priority === p}
                      onChange={() => setPriority(p as TicketPriority)}
                      className="accent-rose-500"
                    />
                    <span className="capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-rose-500 hover:bg-rose-455 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            Submit Help Ticket
          </button>
        </form>
      )}

      {/* Main Grid split: Ticket list on left, detailed thread on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-1 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading queue tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs italic bg-slate-900 border border-slate-850 rounded-3xl">
              No support tickets found in this segment.
            </div>
          ) : (
            tickets.map((t) => {
              const isSelected = selectedTicket?.id === t.id;

              return (
                <div
                  key={t.id}
                  onClick={() => handleOpenTicket(t)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-md ${
                    isSelected ? 'bg-rose-955/10 border-rose-500/40' : 'bg-slate-900 border-slate-850 hover:border-slate-800'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase bg-slate-950 border border-slate-850 text-rose-400">
                        {t.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase font-mono ${
                        t.status === 'RESOLVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-slate-950 text-slate-400'
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-white leading-snug truncate">{t.title}</h3>
                    <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono">
                      <span>Priority: <span className="font-bold uppercase">{t.priority}</span></span>
                      <span>{new Date(t.createdAt?.toMillis ? t.createdAt.toMillis() : t.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Ticket Thread */}
        <div className="lg:col-span-2">
          {selectedTicket ? (
            <div className="p-5 bg-slate-900 border border-slate-850 rounded-3xl space-y-5 shadow-xl flex flex-col justify-between min-h-[400px]">
              <div className="space-y-4">
                {/* Details Section */}
                <div className="space-y-2 border-b border-slate-800/80 pb-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h2 className="text-sm font-black text-white">{selectedTicket.title}</h2>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Logged by: {selectedTicket.creatorName} • Assigned to:{' '}
                        <span className="font-bold text-purple-400">
                          {selectedTicket.assignedAdminName || 'Unassigned'}
                        </span>
                      </p>
                    </div>

                    {userProfile?.role === 'admin' && (
                      <div className="flex flex-wrap gap-2">
                        {!selectedTicket.assignedAdminId && (
                          <button
                            onClick={() => handleAssignToMe(selectedTicket.id!)}
                            className="px-2 py-1 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-[9px] uppercase rounded-lg transition-all"
                          >
                            Assign to me
                          </button>
                        )}

                        <select
                          value={selectedTicket.status}
                          onChange={(e) =>
                            handleUpdateStatus(selectedTicket.id!, e.target.value as TicketStatus, selectedTicket.creatorId)
                          }
                          className="bg-slate-950 border border-slate-805 text-slate-300 rounded-lg px-2 py-1 text-[9px] font-bold focus:outline-none"
                        >
                          {['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED', 'REJECTED'].map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                {/* Discussion timeline */}
                <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                  {replies.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic">No updates in thread discussion yet.</p>
                  ) : (
                    replies.map((rep) => {
                      const isSupport = rep.senderRole !== 'user';

                      return (
                        <div
                          key={rep.id}
                          className={`p-3.5 rounded-2xl border text-xs leading-relaxed max-w-lg ${
                            isSupport
                              ? 'bg-purple-955/10 border-purple-900/30 self-end ml-auto'
                              : 'bg-slate-950 border-slate-850'
                          }`}
                        >
                          <p className="text-slate-300 leading-relaxed">{rep.text}</p>
                          <div className="flex justify-between items-center text-[8px] text-slate-550 font-mono mt-1">
                            <span>{rep.senderName} ({rep.senderRole})</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="pt-4 border-t border-slate-800/80 flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your response to this support case..."
                  className="flex-1 bg-slate-950 border border-slate-805 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sendingReply}
                  className="p-2.5 bg-rose-500 hover:bg-rose-455 text-slate-950 rounded-xl transition-all shadow-md shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs italic bg-slate-900/40 border border-slate-850 rounded-3xl min-h-[300px] flex items-center justify-center">
              Select a support ticket from the list to view its activity thread.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
