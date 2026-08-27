import { sendOtpEmail } from '../services/emailService';
import { 
  validateCollegeDomain, 
  generateCryptographicOtp, 
  hashOtp, 
  generateChallengeId 
} from '../services/otpService';

export interface RequestOtpData {
  email: string;
}

export interface VerifyOtpData {
  email: string;
  otp: string;
}

const RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 5;

/**
 * Backend Cloud Function handler for requesting an Email OTP.
 */
export const requestEmailOtpHandler = async (
  db: any,
  admin: any,
  data: RequestOtpData
): Promise<{ success: boolean; message: string }> => {
  const rawEmail = data?.email || '';
  const email = rawEmail.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    throw new Error('Please enter a valid college email address.');
  }

  if (!validateCollegeDomain(email)) {
    throw new Error('Unsupported college domain. Please use your official college email.');
  }

  const challengeId = generateChallengeId(email);
  const challengeRef = db.collection('otpChallenges').doc(challengeId);
  const nowMs = Date.now();

  const challengeSnap = await challengeRef.get();

  if (challengeSnap.exists) {
    const challengeData = challengeSnap.data();
    const lastSentMs = challengeData.lastSentAt ? challengeData.lastSentAt.toMillis() : 0;
    const hourAgoMs = nowMs - 60 * 60 * 1000;

    // Rate Limit 1: 60s resend cooldown
    if (nowMs - lastSentMs < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (nowMs - lastSentMs)) / 1000);
      throw new Error(`Please wait ${waitSeconds} seconds before requesting a new code.`);
    }

    // Rate Limit 2: Max 5 requests per hour
    const requestsLastHour = challengeData.requestsWindow
      ? challengeData.requestsWindow.filter((t: number) => t > hourAgoMs)
      : [];

    if (requestsLastHour.length >= MAX_REQUESTS_PER_HOUR) {
      throw new Error('Too many verification requests. Please try again in an hour.');
    }
  }

  // Generate 6-digit crypto OTP & hash
  const otpCode = generateCryptographicOtp();
  const hashedCode = hashOtp(otpCode);

  // Challenge document creation/update
  const expiresAtTimestamp = admin.firestore.Timestamp.fromMillis(nowMs + OTP_EXPIRY_MS);
  const previousWindow = challengeSnap.exists ? challengeSnap.data().requestsWindow || [] : [];
  const hourAgoMs = nowMs - 60 * 60 * 1000;
  const updatedWindow = [...previousWindow.filter((t: number) => t > hourAgoMs), nowMs];

  await challengeRef.set(
    {
      emailHash: challengeId,
      otpHash: hashedCode,
      expiresAt: expiresAtTimestamp,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      consumed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
      requestsWindow: updatedWindow,
    },
    { merge: true }
  );

  // Send Nodemailer email
  const sent = await sendOtpEmail({
    recipientEmail: email,
    otpCode,
    expiryMinutes: 5,
  });

  if (!sent) {
    throw new Error("We couldn't send the verification code right now. Please try again.");
  }

  return {
    success: true,
    message: 'Verification code sent if the email is eligible.',
  };
};

/**
 * Backend Cloud Function handler for verifying an Email OTP and creating Firebase Custom Auth Token.
 */
export const verifyEmailOtpHandler = async (
  db: any,
  admin: any,
  data: VerifyOtpData
): Promise<{ success: boolean; customToken: string }> => {
  const rawEmail = data?.email || '';
  const rawOtp = data?.otp || '';

  const email = rawEmail.trim().toLowerCase();
  const otp = rawOtp.trim();

  if (!email || !otp || otp.length !== 6) {
    throw new Error('Please enter the 6-digit verification code.');
  }

  const challengeId = generateChallengeId(email);
  const challengeRef = db.collection('otpChallenges').doc(challengeId);
  const challengeSnap = await challengeRef.get();

  if (!challengeSnap.exists) {
    throw new Error('No active verification request found. Please request a new code.');
  }

  const challengeData = challengeSnap.data();
  const nowMs = Date.now();
  const expiresMs = challengeData.expiresAt ? challengeData.expiresAt.toMillis() : 0;

  if (challengeData.consumed) {
    throw new Error('This verification code has already been used. Please request a new code.');
  }

  if (nowMs > expiresMs) {
    throw new Error('This code has expired. Please request a new code.');
  }

  if (challengeData.attempts >= MAX_ATTEMPTS) {
    throw new Error('Too many failed attempts. Please request a new code.');
  }

  // Hash submitted OTP and compare
  const submittedHash = hashOtp(otp);

  if (submittedHash !== challengeData.otpHash) {
    // Increment failed attempt counter
    await challengeRef.update({
      attempts: admin.firestore.FieldValue.increment(1),
    });

    const remaining = MAX_ATTEMPTS - (challengeData.attempts + 1);
    if (remaining <= 0) {
      throw new Error('Too many failed attempts. Please request a new code.');
    }

    throw new Error(`Incorrect verification code. ${remaining} attempts remaining.`);
  }

  // Mark challenge consumed
  await challengeRef.update({
    consumed: true,
    consumedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Firebase Auth User Creation / Retrieval
  let firebaseUser;
  try {
    firebaseUser = await admin.auth().getUserByEmail(email);
    if (!firebaseUser.emailVerified) {
      await admin.auth().updateUser(firebaseUser.uid, { emailVerified: true });
    }
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      firebaseUser = await admin.auth().createUser({
        email,
        emailVerified: true,
        displayName: email.split('@')[0],
      });
    } else {
      throw err;
    }
  }

  // Ensure user profile in Firestore
  const userRef = db.collection('users').doc(firebaseUser.uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    await userRef.set(
      {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || email.split('@')[0],
        role: 'student',
        points: 0,
        emailVerified: true,
        joinedChannelIds: ['general', 'admin-announcements'],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    await userRef.set({ emailVerified: true, lastLoginAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  // Create Firebase Auth custom token
  const customToken = await admin.auth().createCustomToken(firebaseUser.uid, {
    emailVerified: true,
    provider: 'email_otp',
  });

  return {
    success: true,
    customToken,
  };
};
