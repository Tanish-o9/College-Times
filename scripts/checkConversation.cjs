const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccountPath = 'c:\\Users\\tanis\\Downloads\\college-times-9f395-firebase-adminsdk-fbsvc-4e096d7b7e.json';
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  try {
    console.log('--- ALL CONVERSATIONS IN FIRESTORE ---');
    const snap = await db.collection('conversations').get();
    console.log(`Found ${snap.size} conversation(s).`);
    snap.docs.forEach((d) => {
      const data = d.data();
      console.log(`- DocID: ${d.id}`);
      console.log(`  Participants:`, data.participantIds);
      console.log(`  Names:`, data.participantNames);
      console.log(`  Status: ${data.status}`);
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();
