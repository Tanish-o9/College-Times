import React from 'react';
import type { CampusEvent } from '../../types';
import { formatTimestamp } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, ChevronRight, Clock } from 'lucide-react';

interface EventCardProps {
  event: CampusEvent;
}

export const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const navigate = useNavigate();

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
      className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-sky-500/40 rounded-3xl p-6 shadow-xl flex flex-col justify-between gap-4 cursor-pointer group transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Campus Event</span>
          </span>

          <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatTimestamp(event.createdAt)}</span>
          </span>
        </div>

        <h3 className="text-xl font-bold text-white group-hover:text-sky-400 transition-colors leading-snug">
          {event.title}
        </h3>

        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
          {event.description}
        </p>
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

        <div className="flex items-center gap-3">
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
