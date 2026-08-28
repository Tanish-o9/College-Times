import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let dbInstance: ReturnType<typeof getFirestore> | null = null;
let authInstance: ReturnType<typeof getAuth> | null = null;

export const getFirebaseServices = () => {
  if (dbInstance && authInstance) {
    return { db: dbInstance, auth: authInstance };
  }

  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Server configuration error: Firebase Admin credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are missing in environment variables.');
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log('[FIREBASE ADMIN] Initialized via Service Account credentials.');
  }

  dbInstance = getFirestore();
  authInstance = getAuth();

  return { db: dbInstance, auth: authInstance };
};
