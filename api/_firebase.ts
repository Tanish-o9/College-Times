import * as admin from 'firebase-admin';

let dbInstance: admin.firestore.Firestore | null = null;
let authInstance: admin.auth.Auth | null = null;

export const getFirebaseServices = () => {
  if (dbInstance && authInstance) {
    return { db: dbInstance, auth: authInstance };
  }

  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Server configuration error: Firebase Admin credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are missing in environment variables.');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log('[FIREBASE ADMIN] Initialized via Service Account credentials.');
  }

  dbInstance = admin.firestore();
  authInstance = admin.auth();

  return { db: dbInstance, auth: authInstance };
};
