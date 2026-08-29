import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const CalendarPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [selectedItem, setSelectedItem] = useState<CalendarEventItem | null>(null);

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

  // Conflict Detection: Flag date strings with more than 1 entry scheduled
  const conflicts = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    items.forEach((item) => {
      const dayKey = new Date(item.date).toDateString();
      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(item.title);
    });
    const conflictDates: Record<string, boolean> = {};
    Object.entries(map).forEach(([day, titles]) => {
      if (titles.length > 1) {
        conflictDates[day] = true;
      }
    });
    return conflictDates;
  }, [items]);

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
      if (selectedItem?.id === itemId) setSelectedItem(null);
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
  const totalSlots = 42;
  const nextMonthFill = totalSlots - daysArr.length;
  for (let i = 1; i <= nextMonthFill; i++) {
    daysArr.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  // Week calculation helpers
  const getDaysOfWeek = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(startOfWeek));
      startOfWeek.setDate(startOfWeek.getDate() + 1);
    }
    return days;
  };

  const daysOfWeek = getDaysOfWeek(currentDate);

  const handlePrevRange = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === 'week') {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(prevWeek.getDate() - 7);
      setCurrentDate(prevWeek);
    } else {
      const prevDay = new Date(currentDate);
      prevDay.setDate(prevDay.getDate() - 1);
      setCurrentDate(prevDay);
    }
  };

  const handleNextRange = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === 'week') {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(nextWeek.getDate() + 7);
      setCurrentDate(nextWeek);
    } else {
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setCurrentDate(nextDay);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 flex flex-col lg:flex-row gap-8 relative overflow-hidden">
      {/* Calendar Grid Section */}
      <div className="flex-1 space-y-6">
        {/* Header toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <CalendarIcon className="w-5.5 h-5.5 text-sky-400" />
              <span>Campus Planner 2.0</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">Aggregated events, RSVPs, and deadlines</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switches */}
            <div className="bg-slate-900 p-1 border border-slate-850 rounded-2xl flex">
              {(['month', 'week', 'day', 'agenda'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-[10px] uppercase font-bold rounded-xl transition-all ${
                    viewMode === mode ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevRange}
                className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:text-sky-400 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black uppercase font-mono tracking-wider w-36 text-center text-slate-350 shrink-0">
                {viewMode === 'month' && `${monthNames[month]} ${year}`}
                {viewMode === 'week' && `W/C ${daysOfWeek[0].getDate()} ${monthNames[daysOfWeek[0].getMonth()]}`}
                {viewMode === 'day' && `${currentDate.getDate()} ${monthNames[month]}`}
                {viewMode === 'agenda' && 'All Deadlines'}
              </span>
              <button
                onClick={handleNextRange}
                className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:text-sky-400 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* View Mode Rendering */}
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading planner elements...</span>
          </div>
        ) : (
          <>
            {/* MONTH VIEW */}
            {viewMode === 'month' && (
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase font-mono text-slate-500 tracking-wider">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-2">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {daysArr.map((slot, idx) => {
                    const dateStr = slot.date.toDateString();
                    const dayEvents = items.filter((ev) => new Date(ev.date).toDateString() === dateStr);
                    const isToday = slot.date.toDateString() === new Date().toDateString();
                    const hasConflict = conflicts[dateStr];

                    return (
                      <div
                        key={idx}
                        className={`min-h-[100px] p-2.5 bg-slate-900/60 border rounded-3xl flex flex-col justify-between transition-all hover:border-slate-700 ${
                          slot.isCurrentMonth ? 'border-slate-850 text-white' : 'border-slate-900/20 text-slate-600'
                        } ${isToday ? 'border-sky-500 bg-sky-500/5' : ''}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`text-[10px] font-mono font-black ${isToday ? 'text-sky-400' : ''}`}>
                            {slot.date.getDate()}
                          </span>
                          {hasConflict && (
                            <span className="text-[10px] text-amber-500" title="Scheduling Conflict: Multiple items booked.">⚠️</span>
                          )}
                        </div>

                        <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[60px] scrollbar-none">
                          {dayEvents.map((ev, eIdx) => {
                            let typeColor = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                            if (ev.type === 'deadline') {
                              typeColor = 'bg-rose-500/10 text-rose-455 border-rose-500/20';
                            } else if (ev.type === 'group_event') {
                              typeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                            } else if (ev.type === 'reminder') {
                              typeColor = ev.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20 line-through opacity-50'
                                : 'bg-amber-500/10 text-amber-450 border-amber-500/20';
                            }

                            return (
                              <div
                                key={eIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem(ev);
                                }}
                                className={`text-[8px] px-1.5 py-0.5 border rounded-lg font-bold truncate cursor-pointer transition-all hover:scale-102 ${typeColor}`}
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
            )}

            {/* WEEK VIEW */}
            {viewMode === 'week' && (
              <div className="grid grid-cols-7 gap-3">
                {daysOfWeek.map((day, idx) => {
                  const dateStr = day.toDateString();
                  const dayEvents = items.filter((ev) => new Date(ev.date).toDateString() === dateStr);
                  const isToday = dateStr === new Date().toDateString();
                  const hasConflict = conflicts[dateStr];

                  return (
                    <div
                      key={idx}
                      className={`min-h-[250px] p-4 bg-slate-900/60 border rounded-3xl flex flex-col gap-3 ${
                        isToday ? 'border-sky-500 bg-sky-500/5' : 'border-slate-850'
                      }`}
                    >
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <div>
                          <p className="text-[9px] uppercase font-bold text-slate-500 font-mono">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()]}
                          </p>
                          <p className={`text-base font-black font-mono ${isToday ? 'text-sky-400' : 'text-white'}`}>
                            {day.getDate()}
                          </p>
                        </div>
                        {hasConflict && (
                          <span className="text-xs text-amber-500" title="Scheduling Conflict: Multiple items booked.">⚠️</span>
                        )}
                      </div>

                      <div className="flex-1 space-y-2 overflow-y-auto scrollbar-none">
                        {dayEvents.map((ev, eIdx) => (
                          <div
                            key={eIdx}
                            onClick={() => setSelectedItem(ev)}
                            className="p-2.5 bg-slate-950 border border-slate-850 hover:border-slate-755 rounded-2xl text-[10px] space-y-1 cursor-pointer transition-all"
                          >
                            <p className="font-bold text-white line-clamp-1">{ev.title}</p>
                            <span className="text-[8px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800 uppercase font-mono font-bold">
                              {ev.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* DAY VIEW */}
            {viewMode === 'day' && (
              <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-6 space-y-4">
                <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
                  <h3 className="text-sm font-black text-white">
                    Schedule for {currentDate.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  {conflicts[currentDate.toDateString()] && (
                    <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-450 text-[10px] rounded-full font-bold">
                      ⚠️ Conflict Warning: Overlapping schedule entries
                    </span>
                  )}
                </div>

                <div className="space-y-3.5">
                  {items.filter((ev) => new Date(ev.date).toDateString() === currentDate.toDateString()).length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-12 text-center">No schedule events booked for today.</p>
                  ) : (
                    items
                      .filter((ev) => new Date(ev.date).toDateString() === currentDate.toDateString())
                      .map((ev, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedItem(ev)}
                          className="p-4 bg-slate-950 border border-slate-850 hover:border-slate-755 rounded-2xl flex items-center justify-between cursor-pointer transition-all"
                        >
                          <div className="space-y-1">
                            <p className="text-xs font-black text-white">{ev.title}</p>
                            {ev.description && <p className="text-[10px] text-slate-450">{ev.description}</p>}
                          </div>
                          <span className="text-[10px] text-sky-400 font-mono font-bold shrink-0">
                            {new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* AGENDA VIEW */}
            {viewMode === 'agenda' && (
              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-wider font-mono font-black text-slate-450">Upcoming Deadlines & Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items
                    .filter((i) => i.type === 'deadline')
                    .map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedItem(item)}
                        className="p-4 bg-slate-900 border border-slate-850 hover:border-slate-755 rounded-3xl flex items-start justify-between gap-4 cursor-pointer transition-all"
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="text-xs font-black text-white truncate">{item.title}</p>
                          <p className="text-[10px] text-slate-400 line-clamp-1">{item.description}</p>
                        </div>
                        <span className="text-[9px] px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono rounded-xl shrink-0">
                          {new Date(item.date).toLocaleDateString([], { dateStyle: 'short' })}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sidebar Tasks / Reminders list */}
      <div className="w-full lg:w-80 space-y-6 shrink-0">
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
          <form onSubmit={handleAddReminder} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-lg">
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. CS101 Exam Preparation"
                className="w-full px-3 py-1.5 bg-slate-955 border border-slate-850 rounded-xl text-xs focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Description</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Topics covered, notes..."
                className="w-full px-3 py-1.5 bg-slate-955 border border-slate-850 rounded-xl text-xs focus:outline-none h-14 resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Scheduled Date</label>
              <input
                type="datetime-local"
                required
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-955 border border-slate-850 rounded-xl text-xs focus:outline-none text-slate-300"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Priority</label>
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-955 border border-slate-850 rounded-xl text-xs focus:outline-none text-slate-300"
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
                  onClick={() => setSelectedItem(rem)}
                  className={`p-4 bg-slate-900 border rounded-2xl flex items-start gap-3 transition-all cursor-pointer ${
                    isCompleted ? 'border-slate-955 opacity-60' : 'border-slate-850 hover:border-slate-700'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStatus(rem.id, rem.status);
                    }}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(rem.id);
                    }}
                    className="p-1 hover:text-rose-500 transition-all text-slate-600 self-start"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Event Details Drawer Overlay */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl animate-[slideLeft_0.2s_ease-out] rounded-3xl sm:rounded-l-3xl sm:rounded-r-none">
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[9px] px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono rounded-full font-bold uppercase">
                    {selectedItem.type.replace('_', ' ')}
                  </span>
                  <h3 className="text-base font-black text-white mt-1.5">{selectedItem.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold uppercase transition-all"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Scheduled Time</span>
                  <p className="text-xs text-slate-200 font-medium">
                    {new Date(selectedItem.date).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                  </p>
                </div>

                {selectedItem.description && (
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Description</span>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-2xl border border-slate-850">
                      {selectedItem.description}
                    </p>
                  </div>
                )}

                {selectedItem.location && (
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Venue / Coordinates</span>
                    <p className="text-xs text-slate-200 font-semibold">📍 {selectedItem.location}</p>
                  </div>
                )}

                {selectedItem.priority && (
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Priority Status</span>
                    <p className="text-xs text-slate-205 font-bold uppercase font-mono">
                      {selectedItem.priority}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-slate-800 mt-6">
              {selectedItem.type === 'reminder' && selectedItem.status !== 'completed' && (
                <button
                  onClick={() => {
                    handleToggleStatus(selectedItem.id, selectedItem.status);
                    setSelectedItem(null);
                  }}
                  className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold text-xs uppercase rounded-xl transition-all"
                >
                  Mark Completed
                </button>
              )}
              {selectedItem.type === 'reminder' && (
                <button
                  onClick={() => {
                    handleDeleteItem(selectedItem.id);
                  }}
                  className="py-2 px-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Delete
                </button>
              )}
              {selectedItem.type !== 'reminder' && (
                <button
                  onClick={() => {
                    // Navigate to deep links
                    if (selectedItem.type === 'college_event' || selectedItem.type === 'group_event') {
                      navigate(`/events/${selectedItem.id}`);
                    } else if (selectedItem.type === 'deadline') {
                      navigate(`/opportunities`);
                    }
                    setSelectedItem(null);
                  }}
                  className="flex-1 py-2 bg-sky-500 text-slate-950 font-bold text-xs uppercase rounded-xl transition-all"
                >
                  Go to Source Content
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
