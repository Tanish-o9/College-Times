export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface PollData {
  question: string;
  options: PollOption[];
  allowMultiple?: boolean;
  anonymous?: boolean;
  expiresAt: any;
  totalVotes: number;
}

export interface PollVoteRecord {
  uid: string;
  optionIds: string[];
  votedAt: any;
}
