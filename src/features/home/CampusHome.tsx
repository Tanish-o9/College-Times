import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ActiveIncidentStrip } from '../incidents/ActiveIncidentStrip';
import { PeopleYouMayKnow } from '../discovery/PeopleYouMayKnow';
import { HomePreferencesModal } from './HomePreferencesModal';
import { rankHomeWidgets, type HomeWidgetConfig } from '../../services/homeRankingService';
import {
  Sparkles,
  PlusCircle,
  Users,
  Calendar,
  BarChart3,
  Camera,
  Search,
  Sliders,
  Bell,
  MessageSquare,
  Compass,
  TrendingUp,
} from 'lucide-react';

export const CampusHome: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [_widgets, setWidgets] = useState<HomeWidgetConfig[]>(rankHomeWidgets());

  const handlePreferencesSaved = (newConfigs: HomeWidgetConfig[]) => {
    setWidgets(rankHomeWidgets(newConfigs));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col pb-12">
      {/* Top Banner Header */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-sm">
            {userProfile?.displayName ? userProfile.displayName[0].toUpperCase() : 'C'}
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Welcome back, {userProfile?.displayName || 'Student'}</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              @{(userProfile as any)?.username || 'campus'} • {(userProfile as any)?.department || 'AKGEC Campus'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setPrefModalOpen(true)}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 border border-slate-800 transition-colors flex items-center gap-1 text-xs font-semibold"
        >
          <Sliders className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline">Customize</span>
        </button>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Emergency Alert Widget (Always Top Priority) */}
        <ActiveIncidentStrip />

        {/* Quick Actions Strip */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-xl">
          <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Campus Quick Actions</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <button
              onClick={() => navigate('/feed')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left space-y-1 transition-all"
            >
              <PlusCircle className="w-4 h-4 text-sky-400" />
              <div className="text-xs font-bold text-white">Create Post</div>
            </button>
            <button
              onClick={() => navigate('/groups')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left space-y-1 transition-all"
            >
              <Users className="w-4 h-4 text-purple-400" />
              <div className="text-xs font-bold text-white">Create Group</div>
            </button>
            <button
              onClick={() => navigate('/events')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left space-y-1 transition-all"
            >
              <Calendar className="w-4 h-4 text-emerald-400" />
              <div className="text-xs font-bold text-white">Create Event</div>
            </button>
            <button
              onClick={() => navigate('/groups')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left space-y-1 transition-all"
            >
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <div className="text-xs font-bold text-white">Create Poll</div>
            </button>
            <button
              onClick={() => navigate('/groups')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left space-y-1 transition-all"
            >
              <Camera className="w-4 h-4 text-rose-400" />
              <div className="text-xs font-bold text-white">Group Instant</div>
            </button>
            <button
              onClick={() => navigate('/search')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left space-y-1 transition-all"
            >
              <Search className="w-4 h-4 text-cyan-400" />
              <div className="text-xs font-bold text-white">Search Campus</div>
            </button>
          </div>
        </div>

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Feed Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* People You May Know */}
            <PeopleYouMayKnow />

            {/* Recent Activity Quick Card */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Campus Highlights</span>
                </h3>
                <button
                  onClick={() => navigate('/feed')}
                  className="text-xs font-bold text-sky-400 hover:underline"
                >
                  View Smart Feed →
                </button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Stay updated with trending stories, group announcements, upcoming events, and official campus alerts across AKGEC Times.
              </p>
            </div>
          </div>

          {/* Right Navigation & Widgets Sidebar */}
          <div className="space-y-6">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-xl">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-sky-400" />
                <span>Quick Navigation</span>
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => navigate('/notifications')}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-300 font-semibold transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-sky-400" />
                    <span>Activity Center</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">View</span>
                </button>
                <button
                  onClick={() => navigate('/direct')}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-300 font-semibold transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    <span>Direct Messages</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Chats</span>
                </button>
                <button
                  onClick={() => navigate('/connections')}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-300 font-semibold transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Connections</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Network</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Preferences Modal */}
      <HomePreferencesModal
        isOpen={prefModalOpen}
        onClose={() => setPrefModalOpen(false)}
        onSaved={handlePreferencesSaved}
      />
    </div>
  );
};
