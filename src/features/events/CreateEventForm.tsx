import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { createEvent, type CreateEventPayload } from '../../services/eventService';
import type { CampusEvent } from '../../types';
import toast from 'react-hot-toast';
import { X, MapPin, Send, RefreshCw, Shield } from 'lucide-react';

interface CreateEventFormProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: (event: CampusEvent) => void;
}

export const CreateEventForm: React.FC<CreateEventFormProps> = ({
  isOpen,
  onClose,
  onEventCreated,
}) => {
  const { currentUser, userProfile } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setLocation('');
      setEventDate('');
      setSubmitting(false);
    }
  }, [isOpen]);

  const isAdmin = userProfile?.role === 'admin';

  const isFormValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    location.trim().length > 0 &&
    eventDate.trim().length > 0 &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !currentUser || !isAdmin) return;

    setSubmitting(true);
    try {
      const payload: CreateEventPayload = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        eventDate,
      };

      const newEvent = await createEvent(payload, currentUser);
      toast.success('Campus Event Published!', { id: 'event-created' });
      onEventCreated(newEvent);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish event.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create Campus Event</h2>
              <span className="text-[10px] text-purple-400 font-semibold">Admin Access Verified</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="evt-title" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Event Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="evt-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Annual Hackathon 2026 / Cultural Fest"
              required
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-purple-500 rounded-xl text-white text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="evt-desc" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Event Description & Agenda <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="evt-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide event details, schedule, prizes, or guest speaker information..."
              required
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-purple-500 rounded-xl text-white text-sm resize-none"
            />
          </div>

          {/* Location */}
          <div>
            <label htmlFor="evt-loc" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Campus Location / Auditorium <span className="text-rose-400">*</span>
            </label>
            <div className="relative flex items-center">
              <MapPin className="absolute left-3.5 w-4 h-4 text-slate-500" />
              <input
                id="evt-loc"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Main Auditorium, CS Block 2nd Floor"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-purple-500 rounded-xl text-white text-sm"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div>
            <label htmlFor="evt-date" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Event Date & Start Time <span className="text-rose-400">*</span>
            </label>
            <input
              id="evt-date"
              type="datetime-local"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-purple-500 rounded-xl text-white text-sm font-mono"
            />
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 disabled:opacity-40 text-white font-semibold text-sm rounded-xl shadow-lg shadow-purple-500/20 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Publish Event</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
