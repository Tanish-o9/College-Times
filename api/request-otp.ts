import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseServices } from './_firebase';
import { 
  validateCollegeDomain, 
  generateCryptographicOtp, 
  hashOtp, 
  generateChallengeId, 
  sendOtpEmail 
} from './_utils';
import * as admin from 'firebase-admin';

const RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { db } = getFirebaseServices();
    const rawEmail = req.body?.email || '';
    const email = rawEmail.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      res.status(400).json({ error: 'Please enter a valid college email address.' });
      return;
    }

    if (!validateCollegeDomain(email)) {
      res.status(400).json({ error: 'Unsupported college domain. Please use your official college email.' });
      return;
    }

    const challengeId = generateChallengeId(email);
    const challengeRef = db.collection('otpChallenges').doc(challengeId);
    const nowMs = Date.now();

    const challengeSnap = await challengeRef.get();

    if (challengeSnap.exists) {
      const challengeData = challengeSnap.data() || {};
      const lastSentMs = challengeData.lastSentAt ? challengeData.lastSentAt.toMillis() : 0;
      const hourAgoMs = nowMs - 60 * 60 * 1000;

      // Rate Limit 1: 60s resend cooldown
      if (nowMs - lastSentMs < RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (nowMs - lastSentMs)) / 1000);
        res.status(429).json({ error: `Please wait ${waitSeconds} seconds before requesting a new code.` });
        return;
      }

      // Rate Limit 2: Max 5 requests per hour
      const requestsLastHour = challengeData.requestsWindow
        ? challengeData.requestsWindow.filter((t: number) => t > hourAgoMs)
        : [];

      if (requestsLastHour.length >= MAX_REQUESTS_PER_HOUR) {
        res.status(429).json({ error: 'Too many verification requests. Please try again in an hour.' });
        return;
      }
    }

    // Generate 6-digit crypto OTP & hash
    const otpCode = generateCryptographicOtp();
    const hashedCode = hashOtp(otpCode);

    // Challenge document creation/update
    const expiresAtTimestamp = admin.firestore.Timestamp.fromMillis(nowMs + OTP_EXPIRY_MS);
    const previousWindow = challengeSnap.exists ? (challengeSnap.data() || {}).requestsWindow || [] : [];
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
      res.status(500).json({ error: "We couldn't send the verification code right now. Please try again." });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent if the email is eligible.',
    });
  } catch (error: any) {
    console.error('[API REQUEST OTP ERROR]', error.message);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
