import type { Timestamp, FieldValue } from 'firebase/firestore';

// Phase 49 — Opportunity Hub 2.0 type additions

export type OpportunityMode = 'Remote' | 'On-site' | 'Hybrid' | 'Online' | 'Offline' | 'online' | 'offline' | 'hybrid' | 'All';
export type OpportunityStatus = 'draft' | 'active' | 'closing_soon' | 'closed' | 'cancelled' | 'hidden' | 'deleted';

export type OpportunityType =
  | 'Internship'
  | 'Full-Time Job'
  | 'Part-Time Job'
  | 'Hackathon'
  | 'Competition'
  | 'Scholarship'
  | 'Workshop'
  | 'Certification'
  | 'Research Opportunity'
  | 'Freelance'
  | 'Campus Ambassador'
  | 'Open Source'
  | 'Referral'
  // Legacy values from pre-Phase-49 code
  | 'Placement'
  | 'Research'
  | 'Part-time'
  | 'Campus Drive'
  | 'Other';

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'assessment'
  | 'interview'
  | 'selected'
  | 'rejected'
  | 'withdrawn';

export interface Opportunity2 {
  id: string;
  title: string;
  description: string;
  organization?: string;
  type: OpportunityType;
  skills: string[];
  eligibility?: string;
  location?: string;
  workMode?: OpportunityMode;
  stipend?: string;
  salary?: string;
  applicationUrl?: string;
  deadline?: any;
  contactEmail?: string;
  creatorId?: string;
  creatorName?: string;
  creatorAvatar?: string;
  groupId?: string;
  referralAvailable?: boolean;
  status: OpportunityStatus;
  viewCount?: number;
  saveCount?: number;
  createdAt?: Timestamp | FieldValue | any;
}

export interface OpportunityApplication {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  organization: string;
  userId: string;
  status: ApplicationStatus;
  notes?: string;
  appliedAt: Timestamp | FieldValue | any;
  updatedAt?: Timestamp | FieldValue | any;
}

export interface ReferralRequest {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  requesterId: string;
  requesterName: string;
  requesterAvatar?: string;
  referrerId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  note?: string;
  createdAt: Timestamp | FieldValue | any;
}

export interface OpportunityReminder {
  id: string;
  opportunityId: string;
  userId: string;
  reminderType: '24h' | '3d' | 'custom';
  scheduledTime: Timestamp | FieldValue | any;
}

// Backward-compatible alias for legacy code (pre-Phase-49 services)
export interface Opportunity extends Opportunity2 {
  mode?: OpportunityMode;
  organizationName?: string;
  organizationLogo?: string;
  category?: string;
  branches?: string[];
  isOfficial?: boolean;
  applicationLink?: string;
  closingAt?: any;
  createdBy?: string;
  isVerified?: boolean;
  salaryRange?: string;
  applicationDeadline?: any;
  applicationCount?: number;
}

