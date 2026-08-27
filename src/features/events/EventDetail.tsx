import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { CampusEvent } from '../../types';
import { getEventById, hasUserRsvpd, toggleRsvp, getEventParticipants } from '../../services/eventService';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { 
  Calendar, 
  MapPin, 
  Users, 
  ArrowLeft, 
  CheckCircle2, 
  ExternalLink, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export const EventDetail: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // RSVP state
  const [rsvpd, setRsvpd] = useState<boolean>(false);
  const [rsvpCount, setRsvpCount] = useState<number>(0);
  const [togglingRsvp, setTogglingRsvp] = useState<boolean>(false);

  // Participants list
  const [participants, setParticipants] = useState<{ userId: string; userName: string }[]>([]);

  useEffect(() => {
    if (!eventId) return;
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const evtData = await getEventById(eventId);
        if (!evtData) {
          if (mounted) setError('Campus Event not found.');
          return;
        }

        if (mounted) {
          setEvent(evtData);
          setRsvpCount(evtData.rsvpCount ?? 0);
        }

        if (currentUser) {
          const userHasRsvpd = await hasUserRsvpd(eventId, currentUser.uid);
          if (mounted) setRsvpd(userHasRsvpd);
        }

        const partyList = await getEventParticipants(eventId, 20);
        if (mounted) setParticipants(partyList);
      } catch (err: any) {
        if (mounted) setError('Failed to load event details.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [eventId, currentUser]);

  const handleRsvpToggle = async () => {
    if (!currentUser || !event || !event.id || togglingRsvp) return;

    const prevRsvpd = rsvpd;
    const prevCount = rsvpCount;

    // Optimistic UI flip
    const nextRsvpd = !prevRsvpd;
    const nextCount = nextRsvpd ? prevCount + 1 : Math.max(0, prevCount - 1);
    setRsvpd(nextRsvpd);
    setRsvpCount(nextCount);
    setTogglingRsvp(true);

    try {
      const res = await toggleRsvp(event.id, currentUser.uid, userProfile);
      setRsvpd(res.rsvpd);
      setRsvpCount(res.newRsvpCount);

      // Refresh participant list
      const updatedParty = await getEventParticipants(event.id, 20);
      setParticipants(updatedParty);

      toast.success(res.rsvpd ? "RSVP confirmed! You're going 🎉" : "RSVP removed.");
    } catch (err: any) {
      setRsvpd(prevRsvpd);
      setRsvpCount(prevCount);
      toast.error('Failed to update RSVP status.');
    } finally {
      setTogglingRsvp(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-400 mr-2" />
        <span className="text-slate-300 text-sm font-semibold">Loading event details...</span>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-lg mx-auto my-12 p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">{error || 'Event not found'}</h3>
        <button
          onClick={() => navigate('/events')}
          className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
        >
          Back to Events List
        </button>
      </div>
    );
  }

  // Parse Event Date for Google Calendar Generator
  const eventDateObj = event.eventDate
    ? typeof event.eventDate.toDate === 'function'
      ? event.eventDate.toDate()
      : new Date(event.eventDate)
    : new Date();

  const formattedDateStr = eventDateObj.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Google Calendar URL Generator
  const formatISOForGCal = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '');
  const startDateStr = formatISOForGCal(eventDateObj);
  const endDateObj = new Date(eventDateObj.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration default
  const endDateStr = formatISOForGCal(endDateObj);

  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    event.title
  )}&dates=${startDateStr}/${endDateStr}&location=${encodeURIComponent(
    event.location
  )}&details=${encodeURIComponent(event.description)}`;

  // Google Maps Search Link Generator
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `AKGEC ${event.location}`
  )}`;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/events')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Events</span>
      </button>

      {/* Main Detail Card */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Title & Badge */}
        <div className="space-y-2">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400 inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Campus Event Announcement</span>
          </span>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
            {event.title}
          </h1>
        </div>

        {/* Info Grid (Date, Location, Calendar & Map links) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Date & Time
            </span>
            <div className="flex items-center gap-2 text-slate-200 text-xs font-medium">
              <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{formattedDateStr}</span>
            </div>
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:underline font-semibold mt-1"
            >
              <span>Add to Google Calendar</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Venue Location
            </span>
            <div className="flex items-center gap-2 text-slate-200 text-xs font-medium">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{event.location}</span>
            </div>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:underline font-semibold mt-1"
            >
              <span>View Venue on Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Full Event Description */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">About This Event</h3>
          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
            {event.description}
          </p>
        </div>

        {/* RSVP Action Bar */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-300 font-medium">
            <Users className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-white font-mono">{rsvpCount}</span> Students Attending
          </div>

          <button
            onClick={handleRsvpToggle}
            disabled={togglingRsvp}
            className={`px-6 py-3 rounded-2xl font-bold text-sm shadow-xl flex items-center gap-2 transition-all ${
              rsvpd
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-emerald-500/10'
                : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-purple-500/20'
            }`}
          >
            {togglingRsvp ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : rsvpd ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Going ✓</span>
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                <span>RSVP to Event</span>
              </>
            )}
          </button>
        </div>

        {/* Participant Avatar List */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Attending Students ({participants.length})
          </h4>

          {participants.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No RSVPs yet. Be the first student to RSVP!</p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {participants.map((p) => (
                <div
                  key={p.userId}
                  className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 flex items-center gap-1.5"
                >
                  <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 flex items-center justify-center text-[10px] font-bold">
                    {p.userName.charAt(0).toUpperCase()}
                  </div>
                  <span>{p.userName}</span>
                </div>
              ))}
              {rsvpCount > 20 && (
                <span className="text-xs font-semibold text-slate-500 pl-1">
                  and {rsvpCount - 20} others
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
