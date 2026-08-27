import type { Timestamp, FieldValue } from 'firebase/firestore';

export type AlertDeliveryStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped' | 'cancelled';

export type AlertAudienceType = 'campus' | 'department' | 'batch' | 'community' | 'channel';

export type AlertPriority = 'normal' | 'important' | 'emergency';

export type IncidentCategory =
  | 'accident'
  | 'security'
  | 'weather'
  | 'infrastructure'
  | 'event'
  | 'academic'
  | 'transport'
  | 'lost_found'
  | 'general'
  | 'other';

export type AlertLifecycleStatus = 'draft' | 'active' | 'expired' | 'deactivated' | 'deleted' | 'hidden';

export type TimeRangeFilter = 'today' | '7d' | '30d' | '90d' | 'all';

export type AdminAuditAction =
  | 'ALERT_CREATED'
  | 'ALERT_ACTIVATED'
  | 'ALERT_PINNED'
  | 'ALERT_UNPINNED'
  | 'ALERT_ESCALATED'
  | 'ALERT_DEACTIVATED'
  | 'ALERT_DELETED'
  | 'ALERT_EDITED'
  | 'retry_alert'
  | 'cancel_alert'
  | 'deactivate_group'
  | 'policy_change';

export interface NotificationDeliveryDoc {
  postId: string;
  topic: string;
  audienceType: AlertAudienceType;
  priority: AlertPriority;
  status: AlertDeliveryStatus;
  attemptCount: number;
  createdAt: Timestamp | FieldValue | any;
  lastAttemptAt?: Timestamp | FieldValue | any;
  sentAt?: Timestamp | FieldValue | any;
  failedAt?: Timestamp | FieldValue | any;
  errorCode?: string;
  invalidTokenCount?: number;
  successCount?: number;
  failureCount?: number;
  postTitle?: string;
  authorName?: string;
}

export interface AlertMetricsDoc {
  alertId: string;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  uniqueOpenedCount: number;
  dismissedCount: number;
  failedCount: number;
  activeUsersReached: number;
  lastUpdatedAt: Timestamp | FieldValue | any;
}

export interface AlertInteractionDoc {
  alertId: string;
  openedAt?: Timestamp | FieldValue | any;
  dismissedAt?: Timestamp | FieldValue | any;
}

export interface AlertDailySummary {
  date: string; // YYYY-MM-DD
  alertsCreated: number;
  alertsSent: number;
  alertsFailed: number;
  urgentAlerts: number;
  updatedAt: Timestamp | FieldValue | any;
}

export interface AdminAuditLogDoc {
  id?: string;
  actorId: string;
  actorName?: string;
  action: AdminAuditAction;
  resourceType?: 'alert' | 'group' | 'user' | 'system';
  resourceId?: string;
  targetId: string;
  timestamp: Timestamp | FieldValue | any;
  metadata?: Record<string, any>;
}

export interface ActiveAlertDoc {
  postId: string;
  audienceType: AlertAudienceType;
  audienceId?: string;
  priority: AlertPriority;
  incidentCategory?: IncidentCategory;
  title: string;
  createdAt: Timestamp | FieldValue | any;
  expiresAt?: Timestamp | FieldValue | any;
  active: boolean;
  status?: AlertLifecycleStatus;
  pinned?: boolean;
  pinnedUntil?: Timestamp | FieldValue | any;
  channelId?: string;
  messageId?: string;
}

export interface DismissedAlertDoc {
  postId: string;
  dismissedAt: Timestamp | FieldValue | any;
}

export interface AlertReadStateDoc {
  postId: string;
  readAt: Timestamp | FieldValue | any;
}
