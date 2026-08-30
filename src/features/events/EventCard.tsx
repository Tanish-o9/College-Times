import React, { useState } from 'react';
import type { CampusEvent } from '../../types';
import { formatTimestamp } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { deleteEvent } from '../../services/eventService';
import { Calendar, MapPin, Users, ChevronRight, Clock, ExternalLink, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface EventCardProps {
  event: CampusEvent;
  onDelete?: (eventId: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onDelete }) => {
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const isCreatorOrAdmin = Boolean(
    currentUser &&
      (
        (Boolean(event.createdBy) && event.createdBy === currentUser.uid) ||
        (Boolean((event as any).creatorId) && (event as any).creatorId === currentUser.uid) ||
        (Boolean((event as any).organizerId) && (event as any).organizerId === currentUser.uid) ||
        isAdmin
      )
  );

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !event.id || deleting) return;

    if (!window.confirm('Are you sure you want to permanently delete this event?')) {
      return;
    }

    setDeleting(true);
    try {
      await deleteEvent(event.id, currentUser.uid);
      toast.success('Event deleted.');
      onDelete?.(event.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete event.');
    } finally {
      setDeleting(false);
    }
  };

  const formattedDate = event.eventDate
    ? typeof event.eventDate.toDate === 'function'
      ? event.eventDate.toDate().toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date(event.eventDate).toLocaleString()
    : 'TBD';

  return (
    <article
      onClick={() => navigate(`/events/${event.id}`)}
      className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10 rounded-3xl p-6 shadow-xl flex flex-col justify-between gap-4 cursor-pointer group transition-all duration-200 ease-out relative"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Visibility Badge */}
            {event.visibility === 'group' || event.groupId ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center gap-1 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                <Users className="w-3 h-3 text-purple-400" />
                <span>GROUP ONLY {event.groupName ? `• ${event.groupName}` : ''}</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 border border-sky-500/30 text-sky-300 flex items-center gap-1 shadow-[0_0_10px_rgba(56,189,248,0.2)]">
                <Calendar className="w-3 h-3 text-sky-400" />
                <span>PUBLIC</span>
              </span>
            )}

            {/* Category Badge */}
            {event.category && (
              <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-slate-950 border border-slate-800 text-slate-300 uppercase">
                {event.category}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatTimestamp(event.createdAt)}</span>
            </span>

            {isCreatorOrAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Delete Event"
              >
                {deleting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        <h3 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors leading-snug">
          {event.title}
        </h3>

        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
          {event.description}
        </p>

        {event.creatorName && (
          <p className="text-[10px] text-slate-400 font-mono">
            Organized by: <span className="text-slate-200 font-semibold">{event.creatorName}</span>
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-4 flex-wrap font-medium">
          <div className="flex items-center gap-1.5 text-slate-200">
            <Calendar className="w-4 h-4 text-sky-400" />
            <span>{formattedDate}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <MapPin className="w-4 h-4 text-rose-400" />
            <span>{event.location}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {event.externalUrl && (
            <a
              href={event.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(168,85,247,0.25)] hover:scale-105 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
              <span>Event Link ↗</span>
            </a>
          )}

          <div className="flex items-center gap-1 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 font-mono">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>{event.rsvpCount ?? 0} Going</span>
          </div>

          <div className="p-1.5 bg-slate-800 group-hover:bg-sky-500 text-slate-400 group-hover:text-white rounded-xl transition-all">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </article>
  );
};
