/**
 * Standalone Node.js Admin Cleanup Script for College Times / AKGEC Times
 * IMPORTANT: Excluded from client web bundle. Must be executed locally with Node.js using Service Account credentials.
 */

const admin = require('firebase-admin');
const path = require('path');

// Ensure service account path is passed
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
  console.log('------------------------------------------------------------');
  console.log('DRY RUN MODE / CONFIGURATION NOTICE:');
  console.log('To run against live Firestore, set FIREBASE_SERVICE_ACCOUNT_PATH=path/to/key.json');
  console.log('------------------------------------------------------------');
} else {
  const serviceAccount = require(path.resolve(serviceAccountPath));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'college-times-9f395',
  });
}

const db = admin.apps.length > 0 ? admin.firestore() : null;

async function auditAndCleanupTestData(dryRun = true) {
  if (!db) {
    console.log('Skipping live Firestore cleanup execution (No admin credentials initialized).');
    return;
  }

  console.log(`Starting Firestore Data Audit (${dryRun ? 'DRY RUN' : 'EXECUTION'})...\n`);

  const postsSnap = await db.collection('posts').get();
  console.log(`Found ${postsSnap.size} total posts in database.`);

  const testPosts = [];
  postsSnap.forEach((doc) => {
    const data = doc.data();
    const isTest = 
      (data.title && data.title.toLowerCase().includes('test')) ||
      (data.content && data.content.toLowerCase().includes('lorem ipsum')) ||
      (data.content && data.content.toLowerCase().includes('test post'));
    
    if (isTest) {
      testPosts.push({ id: doc.id, title: data.title });
    }
  });

  console.log(`Identified ${testPosts.length} test/lorem-ipsum posts:`);
  testPosts.forEach((p) => console.log(` - [${p.id}] ${p.title}`));

  if (!dryRun && testPosts.length > 0) {
    const batch = db.batch();
    testPosts.forEach((p) => {
      batch.delete(db.collection('posts').doc(p.id));
    });
    await batch.commit();
    console.log(`Successfully deleted ${testPosts.length} test posts from Firestore.`);
  }
}

if (require.main === module) {
  auditAndCleanupTestData(true).catch(console.error);
}

module.exports = { auditAndCleanupTestData };
