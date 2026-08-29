import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  getUpcomingGroupEvents, 
  getPastGroupEvents, 
  createEvent, 
  toggleRsvp, 
  hasUserRsvpd,
  pinEvent,
  getEventParticipants
} from '../../services/eventService';
import type { CampusEvent } from '../../types';
import { Calendar, MapPin, Users, Plus, RefreshCw, X, Check, Pin } from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupEventsProps {
  groupId: string;
  isMember: boolean;
  userRole?: string;
}

export const GroupEvents: React.FC<GroupEventsProps> = ({ groupId, isMember, userRole }) => {
  const { currentUser, userProfile } = useAuth();
  
  const [upcomingEvents, setUpcomingEvents] = useState<CampusEvent[]>([]);
  const [pastEvents, setPastEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [rsvpMap, setRsvpMap] = useState<Record<string, boolean>>({});

  // Create Event Form state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [creating, setCreating] = useState(false);

  const [attendeesMap, setAttendeesMap] = useState<Record<string, { userId: string; userName: string; userAvatar?: string }[]>>({});
  const [loadingAttendees, setLoadingAttendees] = useState<Record<string, boolean>>({});

  const handleToggleAttendees = async (eventId: string) => {
    if (attendeesMap[eventId]) {
      const copy = { ...attendeesMap };
      delete copy[eventId];
      setAttendeesMap(copy);
      return;
    }

    setLoadingAttendees((prev) => ({ ...prev, [eventId]: true }));
    try {
      const list = await getEventParticipants(eventId, 30);
      setAttendeesMap((prev) => ({ ...prev, [eventId]: list }));
    } catch (err) {
      toast.error('Failed to load attendees.');
    } finally {
      setLoadingAttendees((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const canCreate = isMember && (userRole === 'owner' || userRole === 'admin' || userRole === 'moderator');

  const loadEvents = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const [upcoming, past] = await Promise.all([
        getUpcomingGroupEvents(groupId),
        getPastGroupEvents(groupId),
      ]);
      setUpcomingEvents(upcoming);
      setPastEvents(past);

      // Check RSVP status for all upcoming events
      if (currentUser) {
        const rsvpStatusList = await Promise.all(
          upcoming.map(async (e) => {
            const hasRsvpd = await hasUserRsvpd(e.id!, currentUser.uid);
            return { id: e.id!, rsvpd: hasRsvpd };
          })
        );
        const map: Record<string, boolean> = {};
        rsvpStatusList.forEach((x) => {
          map[x.id] = x.rsvpd;
        });
        setRsvpMap(map);
      }
    } catch (err) {
      console.error('Failed to load group events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [groupId, currentUser]);

  const handleRsvp = async (eventId: string) => {
    if (!currentUser) {
      toast.error('Log in to RSVP to events.');
      return;
    }
    try {
      const { rsvpd, newRsvpCount } = await toggleRsvp(eventId, currentUser.uid, userProfile);
      setRsvpMap((prev) => ({ ...prev, [eventId]: rsvpd }));
      setUpcomingEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, rsvpCount: newRsvpCount } : e))
      );
      toast.success(rsvpd ? 'RSVP registered!' : 'RSVP cancelled.');
    } catch (err) {
      toast.error('Failed to update RSVP.');
    }
  };

  const handleTogglePin = async (ev: CampusEvent) => {
    if (!ev.id) return;
    try {
      await pinEvent(ev.id, !ev.pinned);
      toast.success(ev.pinned ? 'Event unpinned.' : 'Event pinned.');
      loadEvents();
    } catch {
      toast.error('Failed to update event pin status.');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !location.trim() || !eventDate || creating || !currentUser) return;

    setCreating(true);
    try {
      await createEvent({
        title,
        description,
        location,
        eventDate,
        groupId,
        visibility: 'group'
      }, currentUser);

      toast.success('Group event created successfully!');
      setTitle('');
      setDescription('');
      setLocation('');
      setEventDate('');
      setIsCreateOpen(false);
      loadEvents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group event.');
    } finally {
      setCreating(false);
    }
  };

  const isManager = userRole === 'owner' || userRole === 'admin';
  const pinnedEvents = upcomingEvents.filter((e) => e.pinned);
  const normalUpcomingEvents = upcomingEvents.filter((e) => !e.pinned);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-rose-400" />
          <span>Group Events</span>
        </h3>

        {canCreate && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Event</span>
          </button>
        )}
      </div>

      {/* Create Event Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsCreateOpen(false)} />
          <form onSubmit={handleCreateEvent} className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-rose-400" />
                <span>Create Group Event</span>
              </h3>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Annual Hackathon Planning"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500/50"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Description</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide date details, goals, agenda, etc."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Location / Venue</label>
                  <input
                     type="text"
                     required
                     value={location}
                     onChange={(e) => setLocation(e.target.value)}
                     placeholder="e.g. Lab 3 or Zoom"
                     className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventDate}
                    onChange={(e) => setDateValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500/50"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              <span>Publish Event</span>
            </button>
          </form>
        </div>
      )}

      {/* Events List */}
      {loading ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
          <span>Loading group events...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Events Section */}
          {pinnedEvents.length > 0 && (
            <div className="p-4 bg-rose-950/10 border border-rose-500/30 rounded-3xl space-y-3">
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold font-mono pl-1">
                <Pin className="w-3.5 h-3.5" />
                <span>Pinned Events ({pinnedEvents.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pinnedEvents.map((e) => {
                  const rsvpd = rsvpMap[e.id!];
                  const dateObj = e.eventDate?.toDate ? e.eventDate.toDate() : new Date(e.eventDate);

                  return (
                    <div key={e.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between gap-4 animate-in fade-in duration-300">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-rose-400 font-bold font-mono flex items-center gap-1.5">
                            {isManager && (
                              <button
                                type="button"
                                onClick={() => handleTogglePin(e)}
                                className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-400 transition-colors"
                                title="Unpin Event"
                              >
                                <Pin className="w-3 h-3 fill-amber-400 text-amber-400" />
                              </button>
                            )}
                            <span>{dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleAttendees(e.id!)}
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-400 font-bold transition-all"
                            title="View Attendees"
                          >
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            <span>{e.rsvpCount} RSVP</span>
                          </button>
                        </div>
                        <h4 className="text-xs font-bold text-white">{e.title}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{e.description}</p>

                        {/* Attendees List Expansion */}
                        {loadingAttendees[e.id!] ? (
                          <div className="pt-2.5 flex items-center gap-1.5 text-[10px] text-slate-550">
                            <RefreshCw className="w-3 h-3 animate-spin text-rose-450" />
                            <span>Loading RSVPs...</span>
                          </div>
                        ) : attendeesMap[e.id!] && (
                          <div className="pt-2.5 border-t border-slate-800/40 flex flex-wrap gap-1.5">
                            {attendeesMap[e.id!].length === 0 ? (
                              <span className="text-[10px] text-slate-500 italic">No RSVPs yet.</span>
                            ) : (
                              attendeesMap[e.id!].map((att) => (
                                <div key={att.userId} className="flex items-center gap-1 bg-slate-950/60 border border-slate-850 px-2 py-0.5 rounded-full text-[9px] text-slate-300">
                                  {att.userAvatar ? (
                                    <img src={att.userAvatar} alt={att.userName} className="w-3 h-3 rounded-full object-cover shrink-0" />
                                  ) : (
                                    <div className="w-3 h-3 rounded-full bg-slate-800 flex items-center justify-center text-[7px] text-white shrink-0 font-bold">
                                      {att.userName.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span>{att.userName}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{e.location}</span>
                        </span>

                        <button
                          onClick={() => handleRsvp(e.id!)}
                          className={`px-3.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 ${
                            rsvpd
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500 hover:bg-rose-400 text-white shadow-md'
                          }`}
                        >
                          {rsvpd ? <Check className="w-3.5 h-3.5" /> : null}
                          <span>{rsvpd ? "RSVP'd" : 'Join Event'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase font-mono">Upcoming Events ({normalUpcomingEvents.length})</h4>
            {normalUpcomingEvents.length === 0 ? (
              <p className="text-xs text-slate-500 italic pl-2">No upcoming group events planned.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {normalUpcomingEvents.map((e) => {
                  const rsvpd = rsvpMap[e.id!];
                  const dateObj = e.eventDate?.toDate ? e.eventDate.toDate() : new Date(e.eventDate);

                  return (
                    <div key={e.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between gap-4 animate-in fade-in duration-300">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-rose-400 font-bold font-mono flex items-center gap-1.5">
                            {isManager && (
                              <button
                                type="button"
                                onClick={() => handleTogglePin(e)}
                                className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-400 transition-colors"
                                title="Pin Event"
                              >
                                <Pin className="w-3 h-3 text-slate-500" />
                              </button>
                            )}
                            <span>{dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleAttendees(e.id!)}
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-400 font-bold transition-all"
                            title="View Attendees"
                          >
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            <span>{e.rsvpCount} RSVP</span>
                          </button>
                        </div>
                        <h4 className="text-xs font-bold text-white">{e.title}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{e.description}</p>

                        {/* Attendees List Expansion */}
                        {loadingAttendees[e.id!] ? (
                          <div className="pt-2.5 flex items-center gap-1.5 text-[10px] text-slate-550">
                            <RefreshCw className="w-3 h-3 animate-spin text-rose-455" />
                            <span>Loading RSVPs...</span>
                          </div>
                        ) : attendeesMap[e.id!] && (
                          <div className="pt-2.5 border-t border-slate-800/40 flex flex-wrap gap-1.5">
                            {attendeesMap[e.id!].length === 0 ? (
                              <span className="text-[10px] text-slate-500 italic">No RSVPs yet.</span>
                            ) : (
                              attendeesMap[e.id!].map((att) => (
                                <div key={att.userId} className="flex items-center gap-1 bg-slate-950/60 border border-slate-850 px-2 py-0.5 rounded-full text-[9px] text-slate-300">
                                  {att.userAvatar ? (
                                    <img src={att.userAvatar} alt={att.userName} className="w-3 h-3 rounded-full object-cover shrink-0" />
                                  ) : (
                                    <div className="w-3 h-3 rounded-full bg-slate-800 flex items-center justify-center text-[7px] text-white shrink-0 font-bold">
                                      {att.userName.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span>{att.userName}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{e.location}</span>
                        </span>

                        <button
                          onClick={() => handleRsvp(e.id!)}
                          className={`px-3.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 ${
                            rsvpd
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500 hover:bg-rose-400 text-white shadow-md'
                          }`}
                        >
                          {rsvpd ? <Check className="w-3.5 h-3.5" /> : null}
                          <span>{rsvpd ? "RSVP'd" : 'Join Event'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase font-mono">Past Events ({pastEvents.length})</h4>
            {pastEvents.length === 0 ? (
              <p className="text-xs text-slate-500 italic pl-2">No past events recorded.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pastEvents.map((e) => {
                  const dateObj = e.eventDate?.toDate ? e.eventDate.toDate() : new Date(e.eventDate);

                  return (
                    <div key={e.id} className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl opacity-75">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-bold font-mono">
                            {dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase">Completed</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-300">{e.title}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{e.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  function setDateValue(val: string) {
    setEventDate(val);
  }
};
