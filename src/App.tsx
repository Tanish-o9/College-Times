import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { GlobalCacheProvider } from './context/GlobalCacheContext';
import { Navbar } from './components/Navbar';
import { RequireAuth } from './components/RequireAuth';
import { RequireAdmin } from './components/RequireAdmin';
import { Skeleton } from './components/Skeleton';
import { FeedPage } from './features/feed/FeedPage';
import { LoginPage } from './features/auth/LoginPage';
import { AccountPage } from './features/account/AccountPage';
import { LostFoundPage } from './features/lostfound/LostFoundPage';
import { EventsList } from './features/events/EventsList';
import { EventDetail } from './features/events/EventDetail';
import { Leaderboard } from './features/leaderboard/Leaderboard';
import { PrivacyPage } from './features/privacy/PrivacyPage';
import { ChatRoom } from './features/chat/ChatRoom';
import { ChannelList } from './features/chat/ChannelList';
const SavedMessagesPage = lazy(() => import('./features/chat/SavedMessagesPage').then(m => ({ default: m.SavedMessagesPage })));
const ChatNotificationSettings = lazy(() => import('./features/chat/ChatNotificationSettings').then(m => ({ default: m.ChatNotificationSettings })));
import { GroupsPage } from './features/groups/GroupsPage';
import { GroupDetailPage } from './features/groups/GroupDetailPage';
const ClubsPage = lazy(() => import('./features/clubs/ClubsPage').then(m => ({ default: m.ClubsPage })));
const ClubDetailPage = lazy(() => import('./features/clubs/ClubDetailPage').then(m => ({ default: m.ClubDetailPage })));
const PersonalAnalyticsPage = lazy(() => import('./features/account/PersonalAnalyticsPage').then(m => ({ default: m.PersonalAnalyticsPage })));
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })));
const ChallengeDashboard = lazy(() => import('./features/challenges/ChallengeDashboard').then(m => ({ default: m.ChallengeDashboard })));
const AcademicHub = lazy(() => import('./features/academic/AcademicHub').then(m => ({ default: m.AcademicHub })));
const SubjectPage = lazy(() => import('./features/academic/SubjectPage').then(m => ({ default: m.SubjectPage })));
const QuestionBoard = lazy(() => import('./features/academic/QuestionBoard').then(m => ({ default: m.QuestionBoard })));
const SupportCenter = lazy(() => import('./features/support/SupportCenter').then(m => ({ default: m.SupportCenter })));
const AiAssistantPage = lazy(() => import('./features/ai/AiAssistantPage').then(m => ({ default: m.AiAssistantPage })));
const FeedbackPlatform = lazy(() => import('./features/feedback/FeedbackPlatform').then(m => ({ default: m.FeedbackPlatform })));
const PollVotingCenter = lazy(() => import('./features/voting/PollVotingCenter').then(m => ({ default: m.PollVotingCenter })));
const ActivityCenter = lazy(() => import('./features/activity/ActivityCenter').then(m => ({ default: m.ActivityCenter })));

const DirectMessageList = lazy(() => import('./features/directMessages/DirectMessageList').then(m => ({ default: m.DirectMessageList })));
const DirectMessageRoom = lazy(() => import('./features/directMessages/DirectMessageRoom').then(m => ({ default: m.DirectMessageRoom })));

const GroupMembersPage = lazy(() => import('./features/groups/GroupMembersPage').then(m => ({ default: m.GroupMembersPage })));
const GroupSettingsPage = lazy(() => import('./features/groups/GroupSettingsPage').then(m => ({ default: m.GroupSettingsPage })));
const GroupModerationPage = lazy(() => import('./features/groups/GroupModerationPage').then(m => ({ default: m.GroupModerationPage })));
const GroupActivityDashboard = lazy(() => import('./features/groups/GroupActivityDashboard').then(m => ({ default: m.GroupActivityDashboard })));
const GroupInsightsPage = lazy(() => import('./features/groups/GroupInsightsPage').then(m => ({ default: m.GroupInsightsPage })));

const SearchPage = lazy(() => import('./features/search/SearchPage').then(m => ({ default: m.SearchPage })));

import { BreakingAlertBanner } from './features/alerts/BreakingAlertBanner';
const AlertCenter = lazy(() => import('./features/alerts/AlertCenter').then(m => ({ default: m.AlertCenter })));
import { ActiveIncidentStrip } from './features/incidents/ActiveIncidentStrip';
const IncidentDetail = lazy(() => import('./features/incidents/IncidentDetail').then(m => ({ default: m.IncidentDetail })));
import { CampusAlertBanner } from './components/CampusAlertBanner';
import { CampusNotificationPrompt } from './components/CampusNotificationPrompt';

const MyIncidentReports = lazy(() => import('./features/incidents/MyIncidentReports').then(m => ({ default: m.MyIncidentReports })));
const IncidentReportDetail = lazy(() => import('./features/incidents/IncidentReportDetail').then(m => ({ default: m.IncidentReportDetail })));

const NotificationsPage = lazy(() => import('./features/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
import { NotificationPreferences } from './features/notifications/NotificationPreferences';
import { SystemHealthPage } from './features/admin/SystemHealthPage';
const VerificationQueue = lazy(() => import('./features/admin/VerificationQueue').then(m => ({ default: m.VerificationQueue })));
import { ProfilePage } from './features/profile/ProfilePage';
import { ConnectionsPage } from './features/profile/ConnectionsPage';
import { CampusHome } from './features/home/CampusHome';
import { MarketplacePage } from './features/marketplace/MarketplacePage';
import { ListingDetailPage } from './features/marketplace/ListingDetailPage';
import { MyApplications } from './features/opportunities/MyApplications';
import { DiscoverPage } from './features/discover/DiscoverPage';
import { SettingsHub } from './features/settings/SettingsHub';
import { SavedPage } from './features/saved/SavedPage';
import { ActivityPage } from './features/profile/ActivityPage';
import { ReportsPage } from './features/profile/ReportsPage';

// Code-split heavy AdminPortal route
const AdminPage = lazy(() => import('./features/admin/AdminPage').then(module => ({ default: module.AdminPage })));

export const App: React.FC = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AuthProvider>
      <GlobalCacheProvider>
        <Router>
          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
          <Toaster 
            position="top-right" 
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '0.75rem',
              },
            }} 
          />
          <Navbar />
          <CampusNotificationPrompt />
          <main className="flex-1 container mx-auto px-4 py-6">
            <ActiveIncidentStrip />
            <CampusAlertBanner />
            <BreakingAlertBanner />
            <Suspense fallback={
              <div className="p-8 space-y-4">
                <Skeleton variant="rectangular" className="h-12 w-full animate-pulse" />
                <Skeleton variant="card" />
              </div>
            }>
              <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<CampusHome />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/marketplace" element={<MarketplacePage />} />
                <Route path="/marketplace/:listingId" element={<ListingDetailPage />} />
                <Route path="/lost-found" element={<LostFoundPage />} />
                <Route path="/events" element={<EventsList />} />
                <Route path="/events/:eventId" element={<EventDetail />} />
                <Route path="/opportunities/applications" element={<MyApplications />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/messages" element={<DirectMessageList />} />
                <Route path="/messages/:conversationId" element={<DirectMessageRoom />} />
                <Route path="/chat/:channelId" element={<ChatRoom />} />
                <Route path="/channels" element={<ChannelList />} />
                <Route path="/groups" element={<GroupsPage />} />
                <Route path="/groups/join" element={<GroupsPage />} />
                <Route path="/groups/:groupId" element={<GroupDetailPage />} />
                <Route path="/clubs" element={<ClubsPage />} />
                <Route path="/clubs/:groupId" element={<ClubDetailPage />} />
                <Route path="/groups/:groupId/members" element={<GroupMembersPage />} />
                <Route path="/groups/:groupId/settings" element={<GroupSettingsPage />} />
                <Route path="/groups/:groupId/moderation" element={<GroupModerationPage />} />
                <Route path="/groups/:groupId/dashboard" element={<GroupActivityDashboard />} />
                <Route path="/groups/:groupId/insights" element={<GroupInsightsPage />} />
                <Route path="/alerts" element={<AlertCenter />} />
                <Route path="/incidents/:incidentId" element={<IncidentDetail />} />
                <Route path="/my-reports" element={<MyIncidentReports />} />
                <Route path="/my-reports/:reportId" element={<IncidentReportDetail />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/activity" element={<ActivityCenter />} />
                <Route path="/saved-messages" element={<SavedMessagesPage />} />
                <Route path="/chat/settings" element={<ChatNotificationSettings />} />
                <Route path="/settings/notifications" element={<NotificationPreferences />} />
                <Route path="/settings" element={<SettingsHub />} />
                <Route path="/settings/:tab" element={<SettingsHub />} />
                <Route path="/settings/activity" element={<ActivityPage />} />
                <Route path="/settings/reports" element={<ReportsPage />} />
                <Route path="/profile/:username" element={<ProfilePage />} />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/saved" element={<SavedPage />} />
                <Route path="/analytics" element={<PersonalAnalyticsPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/academic" element={<AcademicHub />} />
                <Route path="/academic/subjects/:subjectId" element={<SubjectPage />} />
                <Route path="/academic/subjects/:subjectId/questions/:questionId" element={<QuestionBoard />} />
                <Route path="/support" element={<SupportCenter />} />
                <Route path="/assistant" element={<AiAssistantPage />} />
                <Route path="/challenges" element={<ChallengeDashboard />} />
                <Route path="/feedback" element={<FeedbackPlatform />} />
                <Route path="/voting" element={<PollVotingCenter />} />
                <Route element={<RequireAdmin />}>
                  <Route 
                    path="/admin-portal" 
                    element={
                      <Suspense fallback={<div className="p-8 space-y-4"><Skeleton variant="rectangular" className="h-12 w-full" /><Skeleton variant="card" /></div>}>
                        <AdminPage />
                      </Suspense>
                    } 
                  />
                  <Route 
                    path="/admin/system-health" 
                    element={<SystemHealthPage />} 
                  />
                  <Route 
                    path="/admin/verification" 
                    element={<VerificationQueue />} 
                  />
                </Route>
              </Route>
            </Routes>
          </Suspense>
          </main>
          {!isOnline && (
            <div className="fixed bottom-4 left-4 right-4 z-50 p-3.5 bg-red-950/95 border border-red-500/30 rounded-2xl flex items-center justify-between text-xs text-red-200 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping shrink-0" />
                <span>Running in offline mode (active stale cache fallback)</span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-2.5 py-1 bg-red-500 text-slate-950 font-bold rounded-lg hover:bg-red-400 transition-all text-[11px]"
              >
                Reconnect
              </button>
            </div>
          )}
        </div>
      </Router>
      </GlobalCacheProvider>
    </AuthProvider>
  );
};

export default App;
