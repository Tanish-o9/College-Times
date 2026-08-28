import type { NotificationItem } from '../types/notification';

export function getPriorityWeight(priority: string | undefined): number {
  switch (priority) {
    case 'critical':
      return 1000;
    case 'high':
      return 500;
    case 'normal':
      return 100;
    case 'low':
      return 10;
    default:
      return 100;
  }
}

export function rankNotifications(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => {
    // 1. Critical priority goes first
    const pWeightA = getPriorityWeight(a.priority);
    const pWeightB = getPriorityWeight(b.priority);
    if (pWeightA !== pWeightB) {
      return pWeightB - pWeightA;
    }

    // 2. Unread before read
    if (a.read !== b.read) {
      return a.read ? 1 : -1;
    }

    // 3. Recency
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : Number(a.createdAt || 0);
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : Number(b.createdAt || 0);
    return timeB - timeA;
  });
}
