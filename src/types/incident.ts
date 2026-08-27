import type { Timestamp, FieldValue } from 'firebase/firestore';
import type { IncidentCategory } from './alert';

export type { IncidentCategory };

export type IncidentSeverity = 'low' | 'moderate' | 'high' | 'critical';

export type IncidentStatus =
  | 'reported'
  | 'verifying'
  | 'active'
  | 'monitoring'
  | 'resolved'
  | 'dismissed';

export type AffectedArea = 'campus' | 'department' | 'building' | 'batch' | 'community';

export interface Incident {
  id: string;
  title: string;
  summary: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  locationName: string;
  locationLat?: number;
  locationLng?: number;
  affectedArea: AffectedArea;
  affectedAreaId?: string;
  emergencyInstructions?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: Timestamp | FieldValue | any;
  updatedAt: Timestamp | FieldValue | any;
  verifiedAt?: Timestamp | FieldValue | any;
  resolvedAt?: Timestamp | FieldValue | any;
  resolutionSummary?: string;
  currentAlertId?: string;
}

export interface IncidentUpdate {
  id?: string;
  incidentId: string;
  message: string;
  status: IncidentStatus;
  createdBy: string;
  createdByName?: string;
  createdAt: Timestamp | FieldValue | any;
}

export interface IncidentReadState {
  incidentId: string;
  firstOpenedAt: Timestamp | FieldValue | any;
  lastOpenedAt: Timestamp | FieldValue | any;
}

export interface IncidentAcknowledgement {
  incidentId: string;
  acknowledgedAt: Timestamp | FieldValue | any;
}
