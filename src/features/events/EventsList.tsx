import React, { useEffect, useState } from 'react';
import type { CampusEvent } from '../../types';
import { getUpcomingEvents, getPastEvents } from '../../services/eventService';
import { useAuth } from '../../hooks/useAuth';
import { EventCard } from './EventCard';
import { CreateEventForm } from './CreateEventForm';
import { FAB } from '../../components/FAB';
import { Calendar, RefreshCw, AlertCircle, Inbox, Shield } from 'lucide-react';

type TabType = 'upcoming' | 'past';

export const EventsList: React.FC = () => {
  const { userProfile } = useAuth();
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  const isAdmin = userProfile?.role === 'admin';

  const fetchEvents = async (tab: TabType = activeTab) => {
    setLoading(true);
    setError(null);
    try {
      const data = tab === 'upcoming' ? await getUpcomingEvents() : await getPastEvents();
      setEvents(data);
    } catch (err: any) {
      console.error('Failed to fetch events:', err);
      setError(err.message || 'Failed to load campus events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(activeTab);
  }, [activeTab]);

  const handleEventCreated = (newEvent: CampusEvent) => {
    if (activeTab === 'upcoming') {
      setEvents((prev) => [newEvent, ...prev]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Calendar className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Campus Events</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Discover upcoming hackathons, fests, workshops, and RSVP to participate!
          </p>
        </div>

        {/* Admin Create Event Entry Point */}
        {isAdmin && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
          >
            <Shield className="w-4 h-4 text-purple-200" />
            <span>Create Event</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 text-xs font-extrabold border-b-2 transition-all ${
              activeTab === 'upcoming'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            UPCOMING EVENTS
          </button>

          <button
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 text-xs font-extrabold border-b-2 transition-all ${
              activeTab === 'past'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            PAST EVENTS
          </button>
        </div>

        <button
          onClick={() => fetchEvents(activeTab)}
          disabled={loading}
          className="p-2 bg-slate-900 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all text-xs flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
        </button>
      </div>

      {/* Events Feed */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 bg-slate-900/50 border border-slate-800 rounded-3xl animate-pulse p-6 space-y-3">
              <div className="w-28 h-6 bg-slate-800 rounded-full" />
              <div className="w-1/2 h-6 bg-slate-800 rounded-xl" />
              <div className="w-3/4 h-4 bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-rose-300 text-sm text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p>{error}</p>
          <button onClick={() => fetchEvents(activeTab)} className="px-4 py-2 bg-rose-500/20 rounded-xl text-xs font-semibold">
            Retry
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="p-12 bg-slate-900/60 border border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
            <Inbox className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">No {activeTab} events</h3>
            <p className="text-xs text-slate-400 mt-1">
              Check back soon for new campus event announcements!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((evt) => (
            <EventCard key={evt.id} event={evt} />
          ))}
        </div>
      )}

      {/* Admin FAB */}
      {isAdmin && <FAB onClick={() => setIsFormOpen(true)} label="Create Event" />}

      {/* Admin Create Form Modal */}
      {isAdmin && (
        <CreateEventForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onEventCreated={handleEventCreated}
        />
      )}
    </div>
  );
};
