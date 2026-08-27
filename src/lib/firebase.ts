// Firebase v9 Modular SDK Initialization
// Region: asia-south1 (Mumbai) - Configured for lowest latency to India

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'college-times-9f395'}-default-rtdb.firebaseio.com`,
};

// Initialize Firebase App (Singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export Firebase service instances
export { app };
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);

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
