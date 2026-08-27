/**
 * Chat Moderation Config & Denylist Terms
 * Configurable blocked terms for client and server-side message validation.
 */

export const CHAT_BLOCKED_TERMS: string[] = [
  'spam',
  'scam',
  'abuse',
  'hate',
  'nsfw',
  'vulgar',
  'offensive',
  'harass'
];

/**
 * Checks content against denylist terms.
 */
export const isContentBlocked = (content: string): { isBlocked: boolean; term?: string } => {
  if (!content) return { isBlocked: false };
  const lower = content.toLowerCase();

  for (const term of CHAT_BLOCKED_TERMS) {
    if (lower.includes(term.toLowerCase())) {
      return { isBlocked: true, term };
    }
  }

  return { isBlocked: false };
};
