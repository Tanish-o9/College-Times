import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
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
import { SavedMessagesPage } from './features/chat/SavedMessagesPage';
import { ChatNotificationSettings } from './features/chat/ChatNotificationSettings';
import { GroupsPage } from './features/groups/GroupsPage';
import { GroupDetailPage } from './features/groups/GroupDetailPage';

import { DirectMessageList } from './features/directMessages/DirectMessageList';
import { DirectMessageRoom } from './features/directMessages/DirectMessageRoom';

import { GroupMembersPage } from './features/groups/GroupMembersPage';
import { GroupSettingsPage } from './features/groups/GroupSettingsPage';
import { GroupModerationPage } from './features/groups/GroupModerationPage';
import { GroupActivityDashboard } from './features/groups/GroupActivityDashboard';
import { GroupInsightsPage } from './features/groups/GroupInsightsPage';

import { SearchPage } from './features/search/SearchPage';

import { BreakingAlertBanner } from './features/alerts/BreakingAlertBanner';
import { AlertCenter } from './features/alerts/AlertCenter';
import { ActiveIncidentStrip } from './features/incidents/ActiveIncidentStrip';
import { IncidentDetail } from './features/incidents/IncidentDetail';
import { CampusAlertBanner } from './components/CampusAlertBanner';
import { CampusNotificationPrompt } from './components/CampusNotificationPrompt';

import { MyIncidentReports } from './features/incidents/MyIncidentReports';
import { IncidentReportDetail } from './features/incidents/IncidentReportDetail';

import { NotificationsPage } from './features/notifications/NotificationsPage';
import { NotificationPreferences } from './features/notifications/NotificationPreferences';
import { SystemHealthPage } from './features/admin/SystemHealthPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { ConnectionsPage } from './features/profile/ConnectionsPage';
import { CampusHome } from './features/home/CampusHome';
import { MarketplacePage } from './features/marketplace/MarketplacePage';
import { ListingDetailPage } from './features/marketplace/ListingDetailPage';
import { MyApplications } from './features/opportunities/MyApplications';
import { DiscoverPage } from './features/discover/DiscoverPage';

// Code-split heavy AdminPortal route
const AdminPage = lazy(() => import('./features/admin/AdminPage').then(module => ({ default: module.AdminPage })));

export const App: React.FC = () => {
  return (
    <AuthProvider>
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
                <Route path="/saved-messages" element={<SavedMessagesPage />} />
                <Route path="/chat/settings" element={<ChatNotificationSettings />} />
                <Route path="/settings/notifications" element={<NotificationPreferences />} />
                <Route path="/profile/:username" element={<ProfilePage />} />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/account" element={<AccountPage />} />
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
                </Route>
              </Route>
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
