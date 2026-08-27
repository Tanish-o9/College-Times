import type { Timestamp, FieldValue } from 'firebase/firestore';

export type BroadcastSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type BroadcastStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface CampusBroadcastDoc {
  id?: string;
  incidentId: string;
  type: 'campus_incident';
  title: string;
  body: string;
  severity: BroadcastSeverity;
  status: BroadcastStatus;
  topic: string;
  createdAt: Timestamp | FieldValue | any;
  expiresAt?: Timestamp | FieldValue | any;
  broadcastedAt?: Timestamp | FieldValue | any;
  attemptCount?: number;
  lastAttemptAt?: Timestamp | FieldValue | any;
  errorCode?: string;
  createdByName?: string;
}

export interface PushNotificationPayload {
  type: 'campus_incident';
  incidentId: string;
  severity: BroadcastSeverity;
  category: string;
  channel: string;
  title: string;
  body: string;
}
