/**
 * Standalone Admin Seed Script for Chat History Pagination Testing (100+ Messages)
 * Project: College Times / AKGEC Times (college-times-9f395)
 * 
 * IMPORTANT: Excluded from client bundle. Must be executed locally using Node.js with Firebase Admin SDK.
 * Does NOT modify production user points or user profile documents.
 */

const path = require('path');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const targetChannelId = process.argv[2] || 'general';
const messageCount = parseInt(process.argv[3] || '105', 10);

let admin = null;

if (!serviceAccountPath) {
  console.log('------------------------------------------------------------');
  console.log('DRY RUN MODE / CONFIGURATION NOTICE:');
  console.log('To run against live Firestore, install firebase-admin and set FIREBASE_SERVICE_ACCOUNT_PATH=path/to/key.json');
  console.log('Usage: FIREBASE_SERVICE_ACCOUNT_PATH=key.json node scripts/seedChatMessages.cjs [channelId] [count]');
  console.log('------------------------------------------------------------');
} else {
  try {
    admin = require('firebase-admin');
    const serviceAccount = require(path.resolve(serviceAccountPath));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'college-times-9f395',
    });
  } catch (err) {
    console.error('Error initializing Firebase Admin SDK:', err.message);
  }
}

const db = admin && admin.apps.length > 0 ? admin.firestore() : null;

async function seedChatMessages(dryRun = true) {
  console.log(`Starting Chat Messages Seeding (${dryRun ? 'DRY RUN' : 'EXECUTION'})...`);
  console.log(`Target Channel: #${targetChannelId}`);
  console.log(`Generating ${messageCount} test messages...\n`);

  const now = Date.now();
  const baseTime = now - (messageCount * 60 * 1000); // Spread across past minutes

  const batchSize = 500;
  let batch = db ? db.batch() : null;
  let opCount = 0;

  for (let i = 1; i <= messageCount; i++) {
    const msgId = `test_seed_msg_${i.toString().padStart(4, '0')}`;
    const isoString = new Date(baseTime + (i * 60 * 1000)).toISOString();

    const messageData = {
      id: msgId,
      channelId: targetChannelId,
      senderId: 'system_test_seed_bot',
      senderName: 'Test Seed Bot',
      senderRole: 'student',
      content: `[TEST SEED #${i}] Synthetic historical message #${i} for pagination testing.`,
      reactionCounts: {},
      status: 'active',
      createdAt: isoString,
    };

    if (dryRun) {
      if (i <= 5 || i > messageCount - 3) {
        console.log(` -> [DRY RUN] Message #${i}: ID=${msgId}, Time=${isoString}`);
      } else if (i === 6) {
        console.log(` -> [DRY RUN] ... (${messageCount - 8} intermediate messages) ...`);
      }
    } else if (db && batch && admin) {
      const msgRef = db.collection('channels').doc(targetChannelId).collection('messages').doc(msgId);
      batch.set(msgRef, {
        ...messageData,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(isoString)),
      });
      opCount++;

      if (opCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }
  }

  if (!dryRun && db && batch && opCount > 0) {
    await batch.commit();
  }

  console.log(`\nSeeding complete. ${messageCount} test messages generated for #${targetChannelId}.`);
}

if (require.main === module) {
  const isDry = !serviceAccountPath || !admin;
  seedChatMessages(isDry).catch(console.error);
}

module.exports = { seedChatMessages };
