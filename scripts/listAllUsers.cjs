const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccountPath = 'c:\\Users\\tanis\\Downloads\\college-times-9f395-firebase-adminsdk-fbsvc-4e096d7b7e.json';
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();
const db = getFirestore();

async function run() {
  try {
    console.log('--- ALL USERS IN FIREBASE AUTH ---');
    const authUsersResult = await auth.listUsers(100);
    authUsersResult.users.forEach((u) => {
      console.log(`- UID: ${u.uid} | Email: ${u.email} | DisplayName: ${u.displayName}`);
    });

    console.log('\n--- ALL USERS IN FIRESTORE ---');
    const firestoreUsersSnap = await db.collection('users').get();
    firestoreUsersSnap.docs.forEach((d) => {
      const data = d.data();
      console.log(`- DocID: ${d.id} | Email: ${data.email} | DisplayName: ${data.displayName} | Username: ${data.username}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();
