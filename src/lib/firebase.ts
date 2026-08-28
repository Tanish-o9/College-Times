// Firebase v9 Modular SDK Initialization
// Region: asia-south1 (Mumbai) - Configured for lowest latency to India

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';
import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';

const cleanEnvVar = (val: any): string | undefined => {
  if (typeof val === 'string') {
    return val.replace(/^["']|["']$/g, '').trim();
  }
  return val;
};

const firebaseConfig = {
  apiKey: cleanEnvVar(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: cleanEnvVar(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: cleanEnvVar(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: cleanEnvVar(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnvVar(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanEnvVar(import.meta.env.VITE_FIREBASE_APP_ID),
  databaseURL: cleanEnvVar(import.meta.env.VITE_FIREBASE_DATABASE_URL) || `https://${cleanEnvVar(import.meta.env.VITE_FIREBASE_PROJECT_ID) || 'college-times-9f395'}-default-rtdb.firebaseio.com`,
};

// Initialize Firebase App (Singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export Firebase service instances
export { app };
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export const functions = getFunctions(app, 'us-central1');

// Analytics (safely initialized if browser environment supports it)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export const logAnalyticsEvent = async (eventName: string, eventParams?: Record<string, any>) => {
  try {
    const supported = await isSupported();
    if (supported && analytics) {
      logEvent(analytics, eventName, eventParams);
    }
  } catch (err) {
    // Silent fallback if analytics is blocked by ad-blocker
  }
};

export default app;
