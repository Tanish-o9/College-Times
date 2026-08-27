export type OpportunityType =
  | 'Placement'
  | 'Internship'
  | 'Hackathon'
  | 'Scholarship'
  | 'Competition'
  | 'Research'
  | 'Workshop'
  | 'Certification'
  | 'Freelance'
  | 'Part-time'
  | 'Campus Drive'
  | 'Other';

export type OpportunityMode = 'online' | 'offline' | 'hybrid';
export type OpportunityStatus = 'draft' | 'active' | 'closed' | 'expired' | 'hidden' | 'deleted';
export type ApplicationStatus = 'saved' | 'applied' | 'shortlisted' | 'selected' | 'rejected' | 'withdrawn';

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  organizationName: string;
  organizationLogo?: string;
  type: OpportunityType;
  category?: string;
  location?: string;
  mode: OpportunityMode;
  eligibility?: string;
  branches?: string[];
  yearOfStudy?: string[];
  skills?: string[];
  stipend?: string;
  salaryRange?: string;
  applicationUrl: string;
  applicationDeadline: any;
  startDate?: any;
  endDate?: any;
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
  status: OpportunityStatus;
  visibility: 'campus' | 'group' | 'private';
  isOfficial: boolean;
  isVerified: boolean;
  groupId?: string;
  eventId?: string;
  saveCount: number;
  viewCount: number;
  applicationCount: number;
}

export interface OpportunityApplication {
  opportunityId: string;
  status: ApplicationStatus;
  appliedAt: any;
  updatedAt?: any;
}

export interface OpportunityReminder {
  opportunityId: string;
  userId: string;
  createdAt: any;
}

export interface OpportunityPreferenceSettings {
  preferredTypes: OpportunityType[];
  preferredBranches: string[];
  preferredSkills: string[];
  preferredModes: OpportunityMode[];
  preferredLocations: string[];
  updatedAt?: any;
}
