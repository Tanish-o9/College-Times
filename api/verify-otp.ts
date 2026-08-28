import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseServices } from './_firebase';
import { hashOtp, generateChallengeId } from './_utils';
import { FieldValue } from 'firebase-admin/firestore';

const MAX_ATTEMPTS = 5;

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
    const { db, auth } = getFirebaseServices();
    const rawEmail = req.body?.email || '';
    const rawOtp = req.body?.otp || '';

    const email = rawEmail.trim().toLowerCase();
    const otp = rawOtp.trim();

    if (!email || !otp || otp.length !== 6) {
      res.status(400).json({ error: 'Please enter the 6-digit verification code.' });
      return;
    }

    const challengeId = generateChallengeId(email);
    const challengeRef = db.collection('otpChallenges').doc(challengeId);
    const challengeSnap = await challengeRef.get();

    if (!challengeSnap.exists) {
      res.status(404).json({ error: 'No active verification request found. Please request a new code.' });
      return;
    }

    const challengeData = challengeSnap.data() || {};
    const nowMs = Date.now();
    const expiresMs = challengeData.expiresAt ? challengeData.expiresAt.toMillis() : 0;

    if (challengeData.consumed) {
      res.status(400).json({ error: 'This verification code has already been used. Please request a new code.' });
      return;
    }

    if (nowMs > expiresMs) {
      res.status(400).json({ error: 'This code has expired. Please request a new code.' });
      return;
    }

    if (challengeData.attempts >= MAX_ATTEMPTS) {
      res.status(400).json({ error: 'Too many failed attempts. Please request a new code.' });
      return;
    }

    // Hash submitted OTP and compare
    const submittedHash = hashOtp(otp);

    if (submittedHash !== challengeData.otpHash) {
      // Increment failed attempt counter
      await challengeRef.update({
        attempts: FieldValue.increment(1),
      });

      const remaining = MAX_ATTEMPTS - (challengeData.attempts + 1);
      if (remaining <= 0) {
        res.status(400).json({ error: 'Too many failed attempts. Please request a new code.' });
        return;
      }

      res.status(400).json({ error: `Incorrect verification code. ${remaining} attempts remaining.` });
      return;
    }

    // Mark OTP as consumed
    await challengeRef.update({
      consumed: true,
      consumedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Firebase Auth User Creation / Retrieval
    let firebaseUser;
    try {
      firebaseUser = await auth.getUserByEmail(email);
      if (!firebaseUser.emailVerified) {
        await auth.updateUser(firebaseUser.uid, { emailVerified: true });
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        firebaseUser = await auth.createUser({
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
          createdAt: FieldValue.serverTimestamp(),
          lastLoginAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await userRef.set({ emailVerified: true, lastLoginAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    // Create Firebase Auth custom token
    const customToken = await auth.createCustomToken(firebaseUser.uid, {
      emailVerified: true,
      provider: 'email_otp',
    });

    res.status(200).json({
      success: true,
      customToken,
    });
  } catch (error: any) {
    console.error('[API VERIFY OTP ERROR]', error.message);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
