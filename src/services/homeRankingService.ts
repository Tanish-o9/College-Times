export interface HomeWidgetConfig {
  id: string;
  name: string;
  enabled: boolean;
  priorityScore: number;
}

export const defaultHomeWidgets: HomeWidgetConfig[] = [
  { id: 'emergencyAlerts', name: 'Emergency Alerts', enabled: true, priorityScore: 1000 },
  { id: 'quickActions', name: 'Quick Actions', enabled: true, priorityScore: 900 },
  { id: 'upcomingEvents', name: 'Upcoming Events', enabled: true, priorityScore: 800 },
  { id: 'groupActivity', name: 'Group Activity', enabled: true, priorityScore: 750 },
  { id: 'trendingPosts', name: 'Trending Campus Posts', enabled: true, priorityScore: 700 },
  { id: 'moments', name: 'Group Instants', enabled: true, priorityScore: 650 },
  { id: 'activePolls', name: 'Active Polls', enabled: true, priorityScore: 600 },
  { id: 'followingActivity', name: 'Following Activity', enabled: true, priorityScore: 550 },
  { id: 'peopleSuggestions', name: 'People You May Know', enabled: true, priorityScore: 500 },
  { id: 'recentNotifications', name: 'Recent Notifications', enabled: true, priorityScore: 450 },
  { id: 'continueConversations', name: 'Continue Conversations', enabled: true, priorityScore: 400 },
];

export const rankHomeWidgets = (
  customConfigs?: HomeWidgetConfig[]
): HomeWidgetConfig[] => {
  const active = customConfigs && customConfigs.length > 0 ? customConfigs : defaultHomeWidgets;

  // Ensure Emergency Alerts always remains at index 0 (priority 1000)
  const alerts = active.find((w) => w.id === 'emergencyAlerts') || defaultHomeWidgets[0];
  const others = active.filter((w) => w.id !== 'emergencyAlerts' && w.enabled);

  others.sort((a, b) => b.priorityScore - a.priorityScore);

  return [alerts, ...others];
};
