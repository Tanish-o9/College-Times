import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getAggregatedCalendarItems,
  createReminder,
  updateReminder,
  deleteReminder,
  type CalendarEventItem,
} from '../../services/calendarService';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const CalendarPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<CalendarEventItem[]>([]);
  const [, setLoading] = useState<boolean>(true);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Form State for new reminder
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'important' | 'critical'>('normal');

  const loadCalendar = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await getAggregatedCalendarItems(currentUser.uid);
      setItems(data);
    } catch {
      toast.error('Failed to load planner calendar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [currentUser]);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !title || !scheduledFor) return;

    try {
      await createReminder(currentUser.uid, {
        title,
        description: desc,
        scheduledFor: new Date(scheduledFor).toISOString(),
        priority,
        status: 'pending',
      });
      toast.success('Reminder added to planner.');
      setTitle('');
      setDesc('');
      setScheduledFor('');
      setShowAddForm(false);
      loadCalendar();
    } catch {
      toast.error('Failed to save reminder.');
    }
  };

  const handleToggleStatus = async (itemId: string, currentStatus?: string) => {
    if (!currentUser) return;
    try {
      const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      await updateReminder(currentUser.uid, itemId, { status: nextStatus });
      toast.success('Task status updated.');
      loadCalendar();
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!currentUser) return;
    try {
      await deleteReminder(currentUser.uid, itemId);
      toast.success('Reminder removed.');
      loadCalendar();
    } catch {
      toast.error('Failed to delete reminder.');
    }
  };

  // Month Generation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDayDate = new Date(year, month + 1, 0).getDate();
  const prevLastDayDate = new Date(year, month, 0).getDate();

  const daysArr: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month days fill
  for (let i = firstDayIndex; i > 0; i--) {
    daysArr.push({
      date: new Date(year, month - 1, prevLastDayDate - i + 1),
      isCurrentMonth: false,
    });
  }

  // Current month days fill
  for (let i = 1; i <= lastDayDate; i++) {
    daysArr.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  // Next month days fill
  const totalSlots = 42; // standard 6-row calendar
  const nextMonthFill = totalSlots - daysArr.length;
  for (let i = 1; i <= nextMonthFill; i++) {
    daysArr.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 flex flex-col md:flex-row gap-8">
      {/* Calendar Grid Section */}
      <div className="flex-1 space-y-6">
        {/* Header toolbar */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <CalendarIcon className="w-5.5 h-5.5 text-sky-400" />
              <span>Campus Planner</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">Aggregated events, RSVPs, and deadlines</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:text-sky-400 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black uppercase font-mono tracking-wider w-28 text-center text-slate-350">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:text-sky-400 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase font-mono text-slate-500 tracking-wider">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>

        {/* Grid slots */}
        <div className="grid grid-cols-7 gap-1.5">
          {daysArr.map((slot, idx) => {
            const dateStr = slot.date.toDateString();
            const dayEvents = items.filter((ev) => new Date(ev.date).toDateString() === dateStr);
            const isToday = slot.date.toDateString() === new Date().toDateString();

            return (
              <div
                key={idx}
                className={`min-h-[90px] p-2 bg-slate-900/60 border rounded-2xl flex flex-col justify-between transition-all ${
                  slot.isCurrentMonth ? 'border-slate-850 text-white' : 'border-slate-900/20 text-slate-600'
                } ${isToday ? 'border-sky-500 bg-sky-500/5' : ''}`}
              >
                <span className={`text-[10px] font-mono font-black ${isToday ? 'text-sky-400' : ''}`}>
                  {slot.date.getDate()}
                </span>

                {/* Micro events tags */}
                <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[60px] scrollbar-none">
                  {dayEvents.map((ev, eIdx) => {
                    let typeColor = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                    if (ev.type === 'deadline') {
                      typeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                    } else if (ev.type === 'group_event') {
                      typeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                    } else if (ev.type === 'reminder') {
                      typeColor = ev.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20 line-through opacity-50'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                    }

                    return (
                      <div
                        key={eIdx}
                        className={`text-[8px] px-1.5 py-0.5 border rounded font-bold truncate ${typeColor}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar Tasks / Reminders list */}
      <div className="w-full md:w-80 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
          <h3 className="text-xs font-black uppercase tracking-wider font-mono text-slate-350 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Task Reminders</span>
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1 bg-sky-500/10 hover:bg-sky-500 border border-sky-500/20 text-sky-400 hover:text-slate-950 rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Add reminder Inline form */}
        {showAddForm && (
          <form onSubmit={handleAddReminder} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. CS101 Exam Preparation"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Description</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Topics covered, notes..."
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs focus:outline-none h-14 resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Scheduled Date</label>
              <input
                type="datetime-local"
                required
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs focus:outline-none text-slate-300"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Priority</label>
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs focus:outline-none text-slate-300"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-1.5 bg-sky-500 text-slate-950 font-bold text-[10px] uppercase rounded-xl transition-all"
              >
                Save Task
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 bg-slate-950 text-slate-500 font-bold text-[10px] uppercase rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Reminders List */}
        <div className="space-y-3">
          {items.filter((i) => i.type === 'reminder').length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-6">No pending reminders.</p>
          ) : (
            items.filter((i) => i.type === 'reminder').map((rem) => {
              const isCompleted = rem.status === 'completed';
              return (
                <div
                  key={rem.id}
                  className={`p-4 bg-slate-900 border rounded-2xl flex items-start gap-3 transition-all ${
                    isCompleted ? 'border-slate-950 opacity-60' : 'border-slate-850'
                  }`}
                >
                  <button
                    onClick={() => handleToggleStatus(rem.id, rem.status)}
                    className="p-1 hover:text-sky-400 transition-all text-slate-600 self-start"
                  >
                    <CheckCircle2 className={`w-4 h-4 ${isCompleted ? 'text-emerald-450 fill-emerald-500/10' : ''}`} />
                  </button>
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <p className={`text-xs font-bold text-white truncate ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                      {rem.title}
                    </p>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{rem.description}</p>
                    <span className="text-[8px] text-slate-500 font-mono block">
                      {new Date(rem.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteItem(rem.id)}
                    className="p-1 hover:text-rose-500 transition-all text-slate-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
