import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { CampusEvent } from '../../types/models';
import { getEventById, hasUserRsvpd, toggleRsvpStatus, cancelEvent, getEventParticipantsPaginated, toggleSaveEvent, checkEventIsSaved } from '../../services/eventService';
import { toggleEventReminder, hasUserReminder } from '../../services/eventReminderService';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { BackButton } from '../../components/BackButton';
import { 
  Calendar, 
  MapPin, 
  Users, 
  CheckCircle2, 
  ExternalLink, 
  RefreshCw,
  AlertCircle,
  Bell, 
  BellOff, 
  AlertTriangle, 
  X,
  Bookmark,
  Share2
} from 'lucide-react';
import { buildShareableContent } from '../../services/shareService';
import { ShareModal } from '../../components/ShareModal';

export const EventDetail: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // RSVP state
  const [userRsvpStatus, setUserRsvpStatus] = useState<string | null>(null);
  const [rsvpCount, setRsvpCount] = useState<number>(0);
  const [interestedCount, setInterestedCount] = useState<number>(0);
  const [togglingRsvp, setTogglingRsvp] = useState<boolean>(false);

  // Reminder & Cancel Modal state
  const [hasReminder, setHasReminder] = useState<boolean>(false);
  const [togglingReminder, setTogglingReminder] = useState<boolean>(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [togglingSave, setTogglingSave] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Participants list & pagination
  const [participants, setParticipants] = useState<{ userId: string; userName: string }[]>([]);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);

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
          setInterestedCount(evtData.interestedCount ?? 0);
        }

        if (currentUser) {
          const [userHasRsvpd, remStatus, savedStatus] = await Promise.all([
            hasUserRsvpd(eventId, currentUser.uid),
            hasUserReminder(eventId, currentUser.uid),
            checkEventIsSaved(eventId, currentUser.uid),
          ]);
          if (mounted) {
            setUserRsvpStatus(userHasRsvpd ? 'going' : null);
            setHasReminder(remStatus);
            setIsSaved(savedStatus);
          }
        }

        const res = await getEventParticipantsPaginated(eventId, null, 10);
        if (mounted) {
          setParticipants(res.participants);
          setLastVisible(res.lastVisible);
          setHasMore(res.participants.length === 10);
        }
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

  const handleLoadMoreParticipants = async () => {
    if (!eventId || loadingMore || !lastVisible) return;
    setLoadingMore(true);
    try {
      const res = await getEventParticipantsPaginated(eventId, lastVisible, 10);
      setParticipants((prev) => [...prev, ...res.participants]);
      setLastVisible(res.lastVisible);
      setHasMore(res.participants.length === 10);
    } catch (err) {
      toast.error('Failed to load more participants.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRsvpChange = async (newStatus: 'going' | 'interested' | 'maybe' | 'cancelled') => {
    if (!currentUser || !event || !event.id || togglingRsvp) return;
    setTogglingRsvp(true);

    try {
      const res = await toggleRsvpStatus(event.id, currentUser.uid, newStatus, userProfile);
      setUserRsvpStatus(res.status === 'cancelled' ? null : res.status);
      setRsvpCount(res.rsvpCount);
      setInterestedCount(res.interestedCount);

      const partyRes = await getEventParticipantsPaginated(event.id, null, 10);
      setParticipants(partyRes.participants);
      setLastVisible(partyRes.lastVisible);
      setHasMore(partyRes.participants.length === 10);

      toast.success(newStatus === 'cancelled' ? 'RSVP removed.' : `RSVP updated to ${newStatus}!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update RSVP status.');
    } finally {
      setTogglingRsvp(false);
    }
  };

  const handleReminderToggle = async () => {
    if (!currentUser || !event || !event.id || togglingReminder) return;
    setTogglingReminder(true);

    try {
      const enabled = await toggleEventReminder(event.id, currentUser.uid, event.title);
      setHasReminder(enabled);
      toast.success(enabled ? 'Reminder enabled!' : 'Reminder disabled.');
    } catch (err: any) {
      toast.error('Failed to toggle reminder.');
    } finally {
      setTogglingReminder(false);
    }
  };

  const handleSaveToggle = async () => {
    if (!currentUser || !event || !event.id || togglingSave) return;
    setTogglingSave(true);
    try {
      const saved = await toggleSaveEvent(event.id, currentUser);
      setIsSaved(saved);
      toast.success(saved ? 'Event saved!' : 'Event removed from saved.');
    } catch (err) {
      toast.error('Failed to save event.');
    } finally {
      setTogglingSave(false);
    }
  };

  const handleConfirmCancelEvent = async () => {
    if (!currentUser || !event || !event.id || cancelling) return;
    if (!cancelReason.trim()) {
      toast.error('Please provide a cancellation reason.');
      return;
    }

    setCancelling(true);
    try {
      await cancelEvent(event.id, cancelReason, currentUser);
      setEvent({ ...event, status: 'cancelled', isCancelled: true, cancellationReason: cancelReason });
      toast.success('Event cancelled.');
      setIsCancelModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel event.');
    } finally {
      setCancelling(false);
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
      <BackButton customFallback="/events" />

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

        {/* Cancellation Notice Banner */}
        {event.isCancelled && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-xs">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-rose-200">Event Cancelled</h4>
              <p className="mt-0.5 leading-relaxed">{event.cancellationReason || 'This campus event has been cancelled by the organizer.'}</p>
            </div>
          </div>
        )}

        {/* Capacity Bar (If capacity set) */}
        {event.capacity && event.capacity > 0 && (
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Registration Capacity</span>
              <span className="font-bold text-slate-200">
                {rsvpCount} / {event.capacity} Seats Filled ({Math.round((rsvpCount / event.capacity) * 100)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-500 ${
                  rsvpCount >= event.capacity ? 'bg-rose-500' : 'bg-purple-500'
                }`}
                style={{ width: `${Math.min(100, Math.round((rsvpCount / event.capacity) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Bar (RSVP, Reminders, Organizer Controls) */}
        {!event.isCancelled && (
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* RSVP Status Selector Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleRsvpChange('going')}
                  disabled={togglingRsvp || (!!event.capacity && rsvpCount >= event.capacity && userRsvpStatus !== 'going')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    userRsvpStatus === 'going'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Going ({rsvpCount})</span>
                </button>

                <button
                  onClick={() => handleRsvpChange('interested')}
                  disabled={togglingRsvp}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    userRsvpStatus === 'interested'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-lg shadow-sky-500/10'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>Interested ({interestedCount})</span>
                </button>

                {userRsvpStatus && (
                  <button
                    onClick={() => handleRsvpChange('cancelled')}
                    disabled={togglingRsvp}
                    className="px-3 py-2 bg-slate-950 hover:bg-slate-800 text-rose-400 border border-slate-800 rounded-xl text-xs font-semibold"
                  >
                    Cancel RSVP
                  </button>
                )}
              </div>

              {/* Reminder Toggle & Organizer Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveToggle}
                  disabled={togglingSave}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isSaved
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                  title={isSaved ? 'Event Bookmarked' : 'Save Event'}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'text-sky-400 fill-sky-400' : ''}`} />
                  <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
                </button>

                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
                  title="Share Event"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </button>

                <button
                  onClick={handleReminderToggle}
                  disabled={togglingReminder}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                    hasReminder
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                  title={hasReminder ? 'Reminder Enabled' : 'Enable Event Reminder'}
                >
                  {hasReminder ? <Bell className="w-4 h-4 text-amber-400 fill-amber-400" /> : <BellOff className="w-4 h-4" />}
                  <span className="hidden sm:inline">{hasReminder ? 'Reminder On' : 'Remind Me'}</span>
                </button>

                {currentUser && (event.createdBy === currentUser.uid || userProfile?.role === 'admin') && (
                  <button
                    onClick={() => setIsCancelModalOpen(true)}
                    className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold"
                  >
                    Cancel Event
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Participant Avatar List */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Attending Students ({participants.length})
          </h4>

          {participants.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No RSVPs yet. Be the first student to RSVP!</p>
          ) : (
            <div className="space-y-3">
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
              </div>

              {hasMore && (
                <button
                  type="button"
                  onClick={handleLoadMoreParticipants}
                  disabled={loadingMore}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all"
                >
                  {loadingMore ? <RefreshCw className="w-3 h-3 animate-spin text-purple-400" /> : null}
                  <span>Load More Attendees</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Organizer Cancel Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsCancelModalOpen(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>Cancel Campus Event</span>
              </h3>
              <button onClick={() => setIsCancelModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Provide a reason for cancellation. Registered attendees will be notified.
            </p>

            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Unavoidable venue maintenance conflict..."
              rows={3}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Keep Event
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelEvent}
                disabled={cancelling}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5"
              >
                {cancelling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {isShareModalOpen && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          content={buildShareableContent.event(
            event.id!,
            event.title,
            event.description
          )}
        />
      )}
    </div>
  );
};
