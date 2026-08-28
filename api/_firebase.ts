import * as admin from 'firebase-admin';

const getFirebaseAdmin = () => {
  if (admin.apps.length > 0) {
    return admin;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log('[FIREBASE ADMIN] Initialized via Service Account credentials.');
  } else {
    // Fallback to ADC / Environment default initialization
    admin.initializeApp();
    console.log('[FIREBASE ADMIN] Initialized via default ADC.');
  }

  return admin;
};

export const adminApp = getFirebaseAdmin();
export const db = adminApp.firestore();
export const auth = adminApp.auth();
