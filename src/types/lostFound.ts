export type LostFoundType = 'lost' | 'found';
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ItemStatus = 'active' | 'under_review' | 'claimed' | 'resolved' | 'expired' | 'hidden' | 'deleted';

export interface LostFoundClaim {
  id: string;
  itemId: string;
  itemReporterId: string;
  claimantId: string;
  claimantName: string;
  explanation: string;
  verificationAnswer?: string;
  status: ClaimStatus;
  createdAt: any;
  updatedAt?: any;
}

export interface PrivateVerificationDetails {
  distinctiveFeatures?: string;
  hiddenIdentifier?: string;
  ownershipQuestion?: string;
  reporterId: string;
  createdAt: any;
}

export interface MatchSuggestionResult {
  itemId: string;
  title: string;
  category: string;
  location: string;
  postType: LostFoundType;
  matchScore: number;
  confidenceBand: 'High Match' | 'Possible Match';
}
