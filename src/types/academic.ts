export interface AcademicProfile {
  studentId: string;
  collegeEmail?: string;
  department: string;
  batch: string;
  semester: number;
  collegeName?: string;
  isConnected: boolean;
  connectedAt?: number;
  lastSyncedAt?: number;
  alertThreshold?: number; // Attendance low alert threshold % (default: 75)
}

export interface AcademicAttendanceSubject {
  subjectCode: string;
  subjectName: string;
  totalClasses: number;
  presentClasses: number;
  absentClasses: number;
  percentage: number;
  status: 'Good' | 'Needs Attention' | 'Low';
  lastUpdated?: string | number;
  history?: Array<{
    date: string;
    status: 'present' | 'absent' | 'leave';
  }>;
}

export interface AcademicAttendanceSummary {
  overallPercentage: number;
  totalClasses: number;
  presentClasses: number;
  absentClasses: number;
  totalSubjects: number;
  lowestSubject?: { name: string; percentage: number };
  highestSubject?: { name: string; percentage: number };
  needsAttentionCount: number;
}

export interface AcademicMarksRecord {
  id?: string;
  subjectCode: string;
  subjectName: string;
  assessmentType: string; // 'Mid Sem' | 'End Sem' | 'Quiz' | 'Assignment' | 'Internal'
  obtainedMarks: number;
  maxMarks: number;
  percentage: number;
  grade?: string;
  date?: string;
  semester: number;
}

export interface AcademicMarksSummary {
  overallPercentage: number;
  totalSubjects: number;
  averageMarks: number;
  highestSubject?: { name: string; percentage: number };
  lowestSubject?: { name: string; percentage: number };
  latestAssessment?: string;
}

export interface AcademicSyncMetadata {
  lastSyncedAt: number;
  syncStatus: 'idle' | 'syncing' | 'success' | 'failed' | 'identity_mismatch' | 'unauthorized' | 'source_unavailable';
  recordsCount: {
    attendance: number;
    marks: number;
  };
  source: string;
  lastError?: string;
}

export interface AcademicSyncHistoryRecord {
  id: string;
  timestamp: number;
  status: 'success' | 'failed' | 'identity_mismatch';
  attendanceCount: number;
  marksCount: number;
  source: string;
  errorSummary?: string;
}

export interface EdumarsalConnectConfig {
  studentId: string;
  collegeEmail?: string;
  department: string;
  batch: string;
  semester: number;
  collegeName?: string;
}

export interface AcademicProviderResult {
  profile: AcademicProfile;
  attendance: AcademicAttendanceSubject[];
  marks: AcademicMarksRecord[];
  metadata: AcademicSyncMetadata;
}

export interface AcademicProvider {
  name: string;
  connect(config: EdumarsalConnectConfig): Promise<boolean>;
  fetchAcademicData(config: EdumarsalConnectConfig): Promise<AcademicProviderResult>;
}
