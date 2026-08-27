import type { Timestamp, FieldValue } from 'firebase/firestore';
import type { IncidentCategory } from './alert';

export type ReportStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'dismissed';

export type ReportSeverity = 'unknown' | 'low' | 'moderate' | 'high' | 'critical';

export interface EvidenceAttachment {
  type: 'image' | 'video';
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface IncidentReport {
  id: string;
  reporterId: string;
  reporterDisplayName?: string;
  category: IncidentCategory;
  description: string;
  locationName: string;
  locationLat?: number;
  locationLng?: number;
  evidence?: EvidenceAttachment[];
  status: ReportStatus;
  severity: ReportSeverity;
  createdAt: Timestamp | FieldValue | any;
  reviewedAt?: Timestamp | FieldValue | any;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewStartedAt?: Timestamp | FieldValue | any;
  reviewNote?: string;
  incidentId?: string;
  alertId?: string;
  retentionStatus?: 'active' | 'pending_cleanup' | 'retained';
}
