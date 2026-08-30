import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { createEvent, type CreateEventPayload, getUserJoinedGroupIds } from '../../services/eventService';
import type { CampusEvent } from '../../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { X, MapPin, Send, RefreshCw, Calendar, Globe, Lock, Link } from 'lucide-react';

const CATEGORIES = [
  'Cultural',
  'Technical',
  'Sports',
  'Workshop',
  'Seminar',
  'Placement',
  'Club',
  'Academic',
  'Fest',
  'Competition',
  'Social',
  'Other',
] as const;

interface CreateEventFormProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated?: (event: CampusEvent) => void;
  initialGroupId?: string;
  initialGroupName?: string;
  initialVisibility?: 'campus' | 'group';
}

interface JoinedGroupItem {
  id: string;
  name: string;
}

export const CreateEventForm: React.FC<CreateEventFormProps> = ({
  isOpen,
  onClose,
  onEventCreated,
  initialGroupId,
  initialGroupName,
  initialVisibility,
}) => {
  const { currentUser } = useAuth();

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Technical');
  const [eventDate, setEventDate] = useState('');
  const [endAt, setEndAt] = useState('');
  const [capacity, setCapacity] = useState<string>('');
  const [externalUrl, setExternalUrl] = useState<string>('');
  const [visibility, setVisibility] = useState<'campus' | 'group'>(initialVisibility || (initialGroupId ? 'group' : 'campus'));
  const [groupId, setGroupId] = useState<string>(initialGroupId || '');
  const [groupName, setGroupName] = useState<string>(initialGroupName || '');
  
  const [userGroups, setUserGroups] = useState<JoinedGroupItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setLocation('');
      setCategory('Technical');
      setEventDate('');
      setEndAt('');
      setCapacity('');
      setExternalUrl('');
      setVisibility(initialVisibility || (initialGroupId ? 'group' : 'campus'));
      setGroupId(initialGroupId || '');
      setGroupName(initialGroupName || '');
      setSubmitting(false);

      if (currentUser) {
        setLoadingGroups(true);
        getUserJoinedGroupIds(currentUser.uid).then(async (groupIds) => {
          const groupList: JoinedGroupItem[] = [];
          for (const gId of groupIds) {
            try {
              const gSnap = await getDoc(doc(db, 'groups', gId));
              if (gSnap.exists()) {
                groupList.push({ id: gSnap.id, name: gSnap.data().name || 'Campus Group' });
              }
            } catch {}
          }
          setUserGroups(groupList);
          if (initialGroupId) {
            const found = groupList.find((g) => g.id === initialGroupId);
            if (found) setGroupName(found.name);
          } else if (groupList.length > 0 && !groupId) {
            setGroupId(groupList[0].id);
            setGroupName(groupList[0].name);
          }
        }).finally(() => setLoadingGroups(false));
      }
    }
  }, [isOpen, initialGroupId, initialGroupName, initialVisibility, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('You must be logged in to create an event.');
      return;
    }

    if (!title.trim()) {
      toast.error('Event Title is required.');
      return;
    }
    if (!description.trim()) {
      toast.error('Description & Agenda is required.');
      return;
    }
    if (!location.trim()) {
      toast.error('Campus Location / Hall is required.');
      return;
    }
    if (!eventDate || isNaN(new Date(eventDate).getTime())) {
      toast.error('Please select Start Date & Time using the calendar picker.');
      return;
    }
    if (visibility === 'group' && !groupId.trim()) {
      toast.error('Please select a Target Group for this group event.');
      return;
    }

    if (endAt && !isNaN(new Date(endAt).getTime()) && new Date(endAt).getTime() <= new Date(eventDate).getTime()) {
      toast.error('End time must be after event start time.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedGroup = userGroups.find((g) => g.id === groupId);

      const payload: CreateEventPayload = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        category,
        eventDate,
        ...(endAt && !isNaN(new Date(endAt).getTime()) ? { endAt } : {}),
        ...(capacity && Number(capacity) > 0 ? { capacity: Number(capacity) } : {}),
        ...(externalUrl.trim() ? { externalUrl: externalUrl.trim() } : {}),
        visibility,
        ...(visibility === 'group' ? {
          groupId,
          groupName: groupName || selectedGroup?.name || 'Group Event'
        } : {})
      };

      const newEvent = await createEvent(payload, currentUser);
      toast.success(visibility === 'group' ? 'Group Event Published! 🎉' : 'Campus Event Published! 🎉', { id: 'event-created' });
      if (onEventCreated) onEventCreated(newEvent);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish event.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 pt-20 sm:pt-24 pb-12 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-0" />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[85vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90 backdrop-blur-md sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shadow-md">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Create Event</h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {visibility === 'group' ? 'Group Members Only' : 'Public / Campus-Wide'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto scrollbar-thin">
          {/* Visibility Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
              Event Scope / Visibility <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility('campus')}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  visibility === 'campus'
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-4 h-4 text-sky-400" />
                <span>Public / Campus</span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('group')}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  visibility === 'group'
                    ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-4 h-4 text-purple-400" />
                <span>Group Only</span>
              </button>
            </div>
          </div>

          {/* Group Selector if Visibility is Group */}
          {visibility === 'group' && (
            <div>
              <label className="block text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1 font-mono">
                Select Target Group <span className="text-rose-400">*</span>
              </label>
              {loadingGroups ? (
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span>Loading joined groups...</span>
                </div>
              ) : userGroups.length === 0 ? (
                <p className="text-xs text-rose-400 italic p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  You are not a member of any group. Join a group first to post group events.
                </p>
              ) : (
                <select
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    const found = userGroups.find((g) => g.id === e.target.value);
                    if (found) setGroupName(found.name);
                  }}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white focus:outline-none"
                >
                  {userGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="evt-title" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Event Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="evt-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Hackathon 2026 / Cultural Night"
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="evt-cat" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Category <span className="text-rose-400">*</span>
            </label>
            <select
              id="evt-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white focus:outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="evt-desc" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Description & Agenda <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="evt-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event details, schedule, requirements..."
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
            />
          </div>

          {/* Location */}
          <div>
            <label htmlFor="evt-loc" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Campus Location / Hall <span className="text-rose-400">*</span>
            </label>
            <div className="relative flex items-center">
              <MapPin className="absolute left-3.5 w-4 h-4 text-slate-500" />
              <input
                id="evt-loc"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Main Auditorium / CS Lab 3"
                required
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="evt-start" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                Start Time <span className="text-rose-400">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  ref={startInputRef}
                  id="evt-start"
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => {
                    setEventDate(e.target.value);
                    if (e.target.value) {
                      e.target.blur();
                    }
                  }}
                  onClick={(e) => (e.currentTarget as any).showPicker?.()}
                  required
                  className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white focus:outline-none [color-scheme:dark] cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                />
                <button
                  type="button"
                  onClick={() => startInputRef.current?.showPicker?.()}
                  className="absolute right-2.5 p-1 text-purple-400 hover:text-purple-300 transition-colors"
                  title="Open Calendar Picker"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="evt-end" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                End Time (Optional)
              </label>
              <div className="relative flex items-center">
                <input
                  ref={endInputRef}
                  id="evt-end"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => {
                    setEndAt(e.target.value);
                    if (e.target.value) {
                      e.target.blur();
                    }
                  }}
                  onClick={(e) => (e.currentTarget as any).showPicker?.()}
                  className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white focus:outline-none [color-scheme:dark] cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                />
                <button
                  type="button"
                  onClick={() => endInputRef.current?.showPicker?.()}
                  className="absolute right-2.5 p-1 text-purple-400 hover:text-purple-300 transition-colors"
                  title="Open Calendar Picker"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label htmlFor="evt-cap" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Max Attendee Capacity (Optional)
            </label>
            <input
              id="evt-cap"
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Leave empty for unlimited seats"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* External Event Link */}
          <div>
            <label htmlFor="evt-link" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Event / Registration Link (Optional)
            </label>
            <div className="relative flex items-center">
              <Link className="absolute left-3.5 w-4 h-4 text-purple-400" />
              <input
                id="evt-link"
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="e.g. https://zoom.us/j/... or https://unstop.com/..."
                className="w-full pl-10 pr-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Publishing Event...</span>
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
