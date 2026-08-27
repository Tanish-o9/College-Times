import crypto from 'crypto';

const DEFAULT_SECRET = 'college_times_otp_secret_key_2026_akgec';

/**
 * Validates whether an email belongs to an allowed college domain.
 */
export const validateCollegeDomain = (email: string): boolean => {
  if (!email || !email.includes('@')) return false;

  const normalized = email.trim().toLowerCase();
  const domain = normalized.split('@')[1];
  if (!domain) return false;

  const envDomains = process.env.ALLOWED_COLLEGE_EMAIL_DOMAINS;
  let allowedDomains = ['akgec.ac.in', 'student.akgec.ac.in', 'gmail.com'];

  if (envDomains) {
    allowedDomains = envDomains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  }

  return allowedDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
};

/**
 * Generates a cryptographically secure 6-digit OTP string.
 * Uses Node's crypto.randomInt(100000, 1000000).
 */
export const generateCryptographicOtp = (): string => {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
};

/**
 * Computes an HMAC-SHA256 hash of the 6-digit OTP.
 */
export const hashOtp = (otp: string): string => {
  const secret = process.env.OTP_SECRET || DEFAULT_SECRET;
  return crypto.createHmac('sha256', secret).update(otp.trim()).digest('hex');
};

/**
 * Generates a deterministic SHA256 challenge ID for an email address.
 */
export const generateChallengeId = (email: string): string => {
  const normalized = email.trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
};
