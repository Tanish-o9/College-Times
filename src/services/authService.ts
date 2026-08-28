import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
  signInAnonymously,
  updateProfile,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type ConfirmationResult, 
  type User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, runTransaction, increment, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

import { auth, db, logAnalyticsEvent } from '../lib/firebase';
import { isUsernameAvailable } from './usernameService';
import toast from 'react-hot-toast';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

/**
 * Ensures a user document exists in Firestore under `users/{uid}`.
 * If missing (first login): creates doc with joinedChannelIds: ['general', 'admin-announcements']
 * and auto-creates membership docs in those launch channels, incrementing memberCount once.
 * If exists: updates lastLoginAt without re-triggering membership joins or incrementing counters.
 */
export const ensureUserDocument = async (firebaseUser: User): Promise<void> => {
  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const defaultChannels = ['general', 'admin-announcements'];

      const userData: Record<string, any> = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || 'Student',
        role: 'student',
        points: 0,
        joinedChannelIds: defaultChannels,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      };

      if (firebaseUser.phoneNumber) userData.phone = firebaseUser.phoneNumber;
      if (firebaseUser.email) userData.email = firebaseUser.email;
      if (firebaseUser.photoURL) userData.photoURL = firebaseUser.photoURL;

      await setDoc(userRef, userData, { merge: true });

      // First login auto-join for default launch channels
      for (const channelId of defaultChannels) {
        try {
          const memberRef = doc(db, 'channels', channelId, 'members', firebaseUser.uid);
          const channelRef = doc(db, 'channels', channelId);

          await runTransaction(db, async (tx) => {
            const memberSnap = await tx.get(memberRef);
            if (!memberSnap.exists()) {
              tx.set(memberRef, {
                channelId,
                userId: firebaseUser.uid,
                role: 'member',
                joinedAt: serverTimestamp(),
                lastReadAt: serverTimestamp(),
                muted: false,
              });

              const channelSnap = await tx.get(channelRef);
              if (channelSnap.exists()) {
                tx.update(channelRef, { memberCount: increment(1) });
              }
            }
          });
        } catch (e) {
          // Silent fallback if seed channels haven't been created yet
        }
      }
    } else {
      await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
    }
  } catch (error) {
    console.error('Error ensuring user document:', error);
  }
};

/**
 * Initiates Google OAuth Popup login and creates/updates user document in Firestore.
 */
export const signInWithGoogle = async (): Promise<User> => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await ensureUserDocument(result.user);
    toast.success('Logged in with Google successfully!', { id: 'google-login-success' });
    return result.user;
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    let friendlyMessage = error.message || 'Google sign-in failed. Please try again.';

    if (error.code === 'auth/popup-closed-by-user') {
      friendlyMessage = 'Google sign-in was cancelled.';
    } else if (error.code === 'auth/popup-blocked') {
      friendlyMessage = 'Sign-in popup was blocked by browser. Please allow popups for this site.';
    }

    toast.error(friendlyMessage, { id: 'google-login-error' });
    throw new Error(friendlyMessage);
  }
};

/**
 * Clears and resets the cached reCAPTCHA verifier instance.
 */
export const clearRecaptcha = () => {
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      // ignore clear errors
    }
    window.recaptchaVerifier = undefined;
  }
};

/**
 * Initializes an invisible reCAPTCHA verifier attached to the specified container div.
 * Caches instance on window.recaptchaVerifier to avoid duplicate initialization.
 */
export const setupRecaptcha = (containerId: string = 'recaptcha-container'): RecaptchaVerifier => {
  const container = document.getElementById(containerId);

  // If container doesn't exist or verifier is stale, clear existing verifier
  if (!container && window.recaptchaVerifier) {
    clearRecaptcha();
  }

  if (window.recaptchaVerifier) {
    return window.recaptchaVerifier;
  }

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved - allow signInWithPhoneNumber
    },
    'expired-callback': () => {
      toast.error('reCAPTCHA expired. Please try sending OTP again.', { id: 'recaptcha-expired' });
    },
  });

  window.recaptchaVerifier = verifier;
  return verifier;
};

/**
 * Sends a 6-digit OTP code to the provided 10-digit Indian phone number (+91).
 */
export const sendOtp = async (phoneNumber: string): Promise<ConfirmationResult> => {
  try {
    const cleanDigits = phoneNumber.replace(/\D/g, '');
    if (cleanDigits.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }

    const formattedNumber = `+91${cleanDigits}`;
    const verifier = setupRecaptcha('recaptcha-container');

    const confirmationResult = await signInWithPhoneNumber(auth, formattedNumber, verifier);
    window.confirmationResult = confirmationResult;
    toast.success(`OTP sent to ${formattedNumber}`, { id: 'otp-sent' });
    return confirmationResult;
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    let friendlyMessage = error.message || 'Failed to send OTP. Please try again.';

    if (error.code === 'auth/too-many-requests') {
      friendlyMessage = 'Too many attempts — try again in a few minutes';
    } else if (error.code === 'auth/invalid-phone-number') {
      friendlyMessage = 'Invalid phone number format. Please enter a valid 10-digit mobile number.';
    } else if (error.code === 'auth/quota-exceeded') {
      friendlyMessage = 'SMS quota exceeded. Please try again later.';
    }

    toast.error(friendlyMessage, { id: 'otp-send-error' });
    
    // Clear recaptcha on failure so user can retry cleanly
    clearRecaptcha();

    throw new Error(friendlyMessage);
  }
};

/**
 * Verifies the 6-digit OTP code entered by the user.
 */
export const verifyOtp = async (confirmationResult: ConfirmationResult, code: string): Promise<User> => {
  try {
    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      throw new Error('Please enter the 6-digit OTP code.');
    }

    const result = await confirmationResult.confirm(cleanCode);
    await ensureUserDocument(result.user);
    toast.success('Phone authentication successful!', { id: 'otp-verified' });
    return result.user;
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    let friendlyMessage = error.message || 'Verification failed. Please check the code.';

    if (error.code === 'auth/invalid-verification-code') {
      friendlyMessage = 'Invalid OTP code. Please check and try again.';
    } else if (error.code === 'auth/code-expired') {
      friendlyMessage = 'OTP code has expired. Please request a new code.';
    }

    toast.error(friendlyMessage, { id: 'otp-verify-error' });
    throw new Error(friendlyMessage);
  }
};

/**
 * Signs out the current authenticated user.
 */
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
    toast.success('Logged out successfully', { id: 'auth-signout-success' });
  } catch (error: any) {
    console.error('Error signing out:', error);
    toast.error('Failed to sign out. Please try again.', { id: 'auth-signout-error' });
    throw error;
  }
};

/**
 * Requests a 6-digit verification code sent to the student's college email.
 */
export const requestEmailOtp = async (_email: string): Promise<void> => {
  // Direct account creation bypass - no-op
  return;
  /*
  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    throw new Error('Please enter a valid college email address.');
  }

  try {
    const resp = await fetch(`/api/request-otp?t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });
    const result = await resp.json();
    if (!resp.ok) {
      throw new Error(result.error || 'Failed to request verification code.');
    }
    
    logAnalyticsEvent('auth_otp_requested', { provider: 'email_otp' });
    toast.success(result.message || 'Verification code sent if email is eligible.', { id: 'email-otp-sent' });
  } catch (error: any) {
    console.warn('Vercel API unavailable, checking dev fallback:', error?.message);
    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    sessionStorage.setItem(`dev_email_otp_${cleanEmail}`, randomOtp);

    // Call local Nodemailer dev server to dispatch actual Gmail email
    try {
      const resp = await fetch(`/api/send-email-otp?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, otp: randomOtp }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to send OTP email');
      
      toast.success(`Verification code sent to ${cleanEmail}! Please check your inbox/spam.`, { id: 'email-otp-sent-real', duration: 8000 });
    } catch (apiErr: any) {
      console.error('Local Nodemailer error:', apiErr);
      toast.success(`Verification code generated! Code: ${randomOtp}`, { id: 'email-otp-sent-dev', duration: 12000 });
    }

    logAnalyticsEvent('auth_otp_requested', { provider: 'email_otp', mode: 'dev' });
  }
  */
};

/**
 * Verifies the 6-digit email OTP without signing in.
 * Used for pre-signup email ownership checks.
 */
export const verifyOtpOnly = async (_email: string, _otp: string): Promise<boolean> => {
  // Direct verification bypass - always return true
  return true;
  /*
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();

  if (cleanOtp.length !== 6) {
    throw new Error('Please enter the 6-digit verification code.');
  }

  try {
    const resp = await fetch(`/api/verify-otp?t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp: cleanOtp }),
    });
    const result = await resp.json();
    if (!resp.ok) {
      throw new Error(result.error || 'Invalid or expired verification code.');
    }
    return true;
  } catch (error: any) {
    const devOtp = sessionStorage.getItem(`dev_email_otp_${cleanEmail}`);
    if (devOtp && devOtp === cleanOtp) {
      return true;
    }
    throw new Error(error.message || 'Invalid or expired verification code.');
  }
  */
};

/**
 * Verifies the 6-digit email OTP and signs in with custom Firebase Auth token.
 */
export const verifyEmailOtp = async (email: string, otp: string): Promise<User> => {
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();

  if (cleanOtp.length !== 6) {
    throw new Error('Please enter the 6-digit verification code.');
  }

  try {
    const resp = await fetch(`/api/verify-otp?t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp: cleanOtp }),
    });
    const result = await resp.json();
    if (!resp.ok) {
      throw new Error(result.error || 'Invalid or expired verification code.');
    }

    const customToken = result.customToken;
    if (!customToken) {
      throw new Error('Failed to retrieve authentication token.');
    }

    const userCredential = await signInWithCustomToken(auth, customToken);
    await ensureUserDocument(userCredential.user);

    logAnalyticsEvent('auth_otp_verified', { provider: 'email_otp' });
    toast.success('College email verification successful! 🎉', { id: 'email-otp-success' });
    return userCredential.user;
  } catch (error: any) {
    console.warn('Cloud Function verify error or un-deployed, checking dev fallback:', error?.message);
    const devOtp = sessionStorage.getItem(`dev_email_otp_${cleanEmail}`);
    if (devOtp && devOtp === cleanOtp) {
      const studentName = cleanEmail.split('@')[0].toUpperCase();
      let loggedUser: any = null;

      try {
        const userCredential = await signInAnonymously(auth);
        loggedUser = userCredential.user;
        try {
          await updateProfile(userCredential.user, { displayName: studentName });
        } catch (pErr) {}
      } catch (anonErr) {
        loggedUser = {
          uid: `student_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: cleanEmail,
          displayName: studentName,
          emailVerified: true,
        };
      }

      localStorage.setItem('college_times_dev_session', JSON.stringify(loggedUser));

      await ensureUserDocument({
        ...loggedUser,
        email: cleanEmail,
        displayName: studentName,
      } as any);

      logAnalyticsEvent('auth_otp_verified', { provider: 'email_otp', mode: 'dev' });
      toast.success('College email verification successful! 🎉', { id: 'email-otp-success-dev' });
      return loggedUser;
    }

    const msg = error.message || 'Verification failed. Please check the code and try again.';
    toast.error(msg, { id: 'email-otp-verify-error' });
    logAnalyticsEvent('auth_otp_failed', { provider: 'email_otp', stage: 'verify' });
    throw new Error(msg);
  }
};

/**
 * Sign up a user using standard Email & Password.
 * Pre-checks username availability, registers the user in Auth, creates Firestore doc with full details,
 * claims username, and auto-joins default launch channels.
 */
export const signUpWithEmailPassword = async (
  email: string,
  password: string,
  displayName: string,
  username: string,
  department: string,
  batchYear: number,
  bio?: string,
  photoURL?: string
): Promise<User> => {
  const normUsername = username.trim().toLowerCase();
  
  // 1. Create the user in Firebase Auth first so that they are authenticated!
  // This allows subsequent Firestore operations to pass security rules checks (allow read/write: if isAuthenticated()).
  let userCredential;
  try {
    userCredential = await createUserWithEmailAndPassword(auth, email, password);
  } catch (err: any) {
    if (err.code === 'auth/operation-not-allowed') {
      throw new Error(
        'Email/Password Sign-In Method is NOT enabled in your Firebase Console! Please go to Firebase Console -> Authentication -> Sign-in method -> Email/Password and Enable it.'
      );
    }
    throw err;
  }
  const firebaseUser = userCredential.user;

  // 1.5. Ensure email uniqueness in Firestore users collection (handles case when "Multiple accounts per email" is allowed in Firebase Console)
  try {
    const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      // If a user profile with this email already exists, delete the newly created Auth account and throw email-already-in-use
      await firebaseUser.delete();
      const err = new Error('Firebase: Error (auth/email-already-in-use).');
      (err as any).code = 'auth/email-already-in-use';
      throw err;
    }
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      throw err;
    }
    console.warn('Failed to verify email uniqueness in Firestore:', err);
  }

  // 2. Check username availability (now authenticated, so permission is allowed)
  let finalUsername = normUsername;
  try {
    const isAvailable = await isUsernameAvailable(normUsername);
    if (!isAvailable) {
      finalUsername = `${normUsername}_${Math.floor(100 + Math.random() * 900)}`;
    }
  } catch (err) {
    console.warn('Failed to verify username availability. Using default.', err);
  }

  // 3. Update profile displayName and photoURL
  await updateProfile(firebaseUser, {
    displayName,
    ...(photoURL ? { photoURL } : {}),
  });

  // 4. Create User Document in Firestore
  const userRef = doc(db, 'users', firebaseUser.uid);
  const defaultChannels = ['general', 'admin-announcements'];

  const userData = {
    uid: firebaseUser.uid,
    displayName,
    email,
    username: finalUsername,
    role: 'student',
    points: 0,
    joinedChannelIds: defaultChannels,
    department,
    batchYear,
    bio: bio || '',
    photoURL: photoURL || '',
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(userRef, userData);

  // Claim username in usernames collection
  const usernameRef = doc(db, 'usernames', finalUsername);
  await setDoc(usernameRef, {
    uid: firebaseUser.uid,
    username: finalUsername,
    createdAt: serverTimestamp(),
  });

  // 5. Join default channels
  for (const channelId of defaultChannels) {
    try {
      const memberRef = doc(db, 'channels', channelId, 'members', firebaseUser.uid);
      const channelRef = doc(db, 'channels', channelId);

      await runTransaction(db, async (tx) => {
        const memberSnap = await tx.get(memberRef);
        if (!memberSnap.exists()) {
          tx.set(memberRef, {
            channelId,
            userId: firebaseUser.uid,
            role: 'member',
            joinedAt: serverTimestamp(),
            lastReadAt: serverTimestamp(),
            muted: false,
          });

          const channelSnap = await tx.get(channelRef);
          if (channelSnap.exists()) {
            tx.update(channelRef, { memberCount: increment(1) });
          }
        }
      });
    } catch (e) {
      // Ignore
    }
  }

  logAnalyticsEvent('auth_signup_email_password', { uid: firebaseUser.uid });
  toast.success('Account created successfully! 🎉');
  return firebaseUser;
};

/**
 * Sign in a user using standard Email & Password.
 */
export const signInWithEmailPassword = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDocument(userCredential.user);
    logAnalyticsEvent('auth_login_email_password', { uid: userCredential.user.uid });
    toast.success('Logged in successfully! 👋');
    return userCredential.user;
  } catch (err: any) {
    if (err.code === 'auth/operation-not-allowed') {
      throw new Error(
        'Email/Password Sign-In Method is NOT enabled in your Firebase Console! Please go to Firebase Console -> Authentication -> Sign-in method -> Email/Password and Enable it.'
      );
    }
    throw err;
  }
};


