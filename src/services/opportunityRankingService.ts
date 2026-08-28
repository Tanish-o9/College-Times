import type { Opportunity2 } from '../types/opportunity';

export function scoreOpportunity(
  opportunity: Opportunity2,
  userSkills: string[] = []
): number {
  let score = 100;

  // Skill Match Boost
  if (opportunity.skills && userSkills.length > 0) {
    const matches = opportunity.skills.filter((s) => userSkills.includes(s));
    score += matches.length * 25;
  }

  // Referral Availability Boost
  if (opportunity.referralAvailable) {
    score += 30;
  }

  // Engagement Boost
  score += Math.min(50, (opportunity.saveCount || 0) * 5);

  // Status Filter
  if (opportunity.status === 'closing_soon') {
    score += 40;
  } else if (opportunity.status === 'closed') {
    score = 0;
  }

  return score;
}

export function rankOpportunities(
  opportunities: Opportunity2[],
  userSkills: string[] = []
): Opportunity2[] {
  return [...opportunities].sort((a, b) => {
    const scoreA = scoreOpportunity(a, userSkills);
    const scoreB = scoreOpportunity(b, userSkills);
    return scoreB - scoreA;
  });
}
