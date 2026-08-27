import React, { useState, useEffect } from 'react';
import { getPinnedGroupContent, type PinnedItem } from '../../services/groupPinService';
import { getGroupAnnouncements } from '../../services/groupAnnouncementService';
import { GroupActivityTimeline } from './GroupActivityTimeline';
import type { CampusGroup, GroupAnnouncement } from '../../types/group';
import {
  MessageSquare,
  FileText,
  Sparkles,
  BarChart3,
  Calendar,
  Megaphone,
  Users,
  Pin,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface GroupHomeDashboardProps {
  group: CampusGroup;
  userId?: string;
  onSelectTab: (tab: string) => void;
}

export const GroupHomeDashboard: React.FC<GroupHomeDashboardProps> = ({
  group,
  userId,
  onSelectTab,
}) => {
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);

  const loadDashboardData = async () => {
    if (!group.id) return;
    try {
      const [pins, anns] = await Promise.all([
        getPinnedGroupContent(group.id),
        getGroupAnnouncements(group.id, 3),
      ]);
      setPinnedItems(pins);
      setAnnouncements(anns);
    } catch (err) {
      console.error('Failed to load group dashboard data:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [group.id]);

  const quickActions = [
    { label: 'Chat', icon: MessageSquare, tab: 'chat', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
    { label: 'Posts', icon: FileText, tab: 'posts', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
    { label: 'Moments', icon: Sparkles, tab: 'moments', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
    { label: 'Polls', icon: BarChart3, tab: 'polls', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
    { label: 'Events', icon: Calendar, tab: 'events', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
    { label: 'Announcements', icon: Megaphone, tab: 'announcements', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
    { label: 'Members', icon: Users, tab: 'members', color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/30' },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Action Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {quickActions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.tab}
              onClick={() => onSelectTab(act.tab)}
              className={`p-4 rounded-3xl border ${act.bg} hover:border-slate-600 transition-all flex flex-col items-center justify-center gap-2 group text-center shadow-lg`}
            >
              <Icon className={`w-5 h-5 ${act.color} group-hover:scale-110 transition-transform`} />
              <span className="text-xs font-bold text-white">{act.label}</span>
            </button>
          );
        })}
      </div>

      {/* Pinned Content Section */}
      {pinnedItems.length > 0 && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Pin className="w-4 h-4 text-amber-400" />
              <span>Pinned Content ({pinnedItems.length})</span>
            </h3>
            <button
              onClick={() => onSelectTab('pinned')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <span>View All Pins</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pinnedItems.slice(0, 4).map((pin) => (
              <div
                key={pin.id}
                onClick={() => onSelectTab(pin.targetType === 'moment' ? 'moments' : pin.targetType === 'poll' ? 'polls' : 'posts')}
                className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:border-slate-700 transition-colors flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-bold text-sky-300 uppercase font-mono">{pin.targetType}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Announcements Carousel / Highlights */}
      {announcements.length > 0 && (
        <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-amber-300 uppercase font-mono flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-amber-400" />
              <span>Latest Announcement</span>
            </h3>
            <button
              onClick={() => onSelectTab('announcements')}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <span>View Announcements</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
            <h4 className="text-xs font-bold text-white">{announcements[0].title}</h4>
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{announcements[0].content}</p>
          </div>
        </div>
      )}

      {/* Recent Activity Timeline Preview */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <span>Recent Community Activity</span>
          </h3>
          <button
            onClick={() => onSelectTab('activity')}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
          >
            <span>View Timeline</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <GroupActivityTimeline groupId={group.id} userId={userId} />
      </div>
    </div>
  );
};
