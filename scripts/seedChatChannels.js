/**
 * Standalone Admin Seed Script for Launch Chat Channels
 * Project: College Times / AKGEC Times (college-times-9f395)
 * 
 * IMPORTANT: Excluded from client bundle. Must be executed locally using Node.js with Firebase Admin SDK.
 */

const admin = require('firebase-admin');
const path = require('path');

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

const LAUNCH_CHANNELS = [
  {
    id: 'general',
    name: 'General',
    description: 'Public campus-wide discussions and general announcements',
    category: 'general',
    type: 'public',
    topic: 'Welcome to AKGEC Times Community Chat!',
    memberCount: 0,
    isArchived: false,
  },
  {
    id: 'batch-2026',
    name: 'Batch 2026',
    description: 'Academic batch updates, course notes, and department notices',
    category: 'academic',
    type: 'public',
    topic: 'Academic discussions for Batch of 2026',
    memberCount: 0,
    isArchived: false,
  },
  {
    id: 'lost-found-chat',
    name: 'Lost & Found Chat',
    description: 'Real-time community assistance for lost and found items on campus',
    category: 'general',
    type: 'public',
    topic: 'Report or inquire about lost items',
    memberCount: 0,
    isArchived: false,
  },
  {
    id: 'events-chat',
    name: 'Events Chat',
    description: 'Live chat and discussions around upcoming college fests, workshops, and hackathons',
    category: 'events',
    type: 'public',
    topic: 'Upcoming campus events & activities',
    memberCount: 0,
    isArchived: false,
  },
  {
    id: 'admin-announcements',
    name: 'Official Announcements',
    description: 'Official announcements and verified notices from college administration',
    category: 'general',
    type: 'announcement',
    topic: 'Official Notices (Admin Write Only)',
    memberCount: 0,
    isArchived: false,
  },
];

async function seedChatChannels(dryRun = true) {
  console.log(`Starting Launch Channels Seeding (${dryRun ? 'DRY RUN' : 'EXECUTION'})...\n`);

  for (const channel of LAUNCH_CHANNELS) {
    console.log(`Channel [${channel.id}]: ${channel.name} (${channel.type})`);
    
    if (!dryRun && db) {
      const channelRef = db.collection('channels').doc(channel.id);
      const snap = await channelRef.get();

      if (!snap.exists) {
        await channelRef.set({
          ...channel,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(` -> Created channel doc [${channel.id}]`);
      } else {
        console.log(` -> Channel [${channel.id}] already exists (Skipping creation).`);
      }
    }
  }

  console.log('\nSeeding complete.');
}

if (require.main === module) {
  const isDry = !serviceAccountPath;
  seedChatChannels(isDry).catch(console.error);
}

module.exports = { seedChatChannels, LAUNCH_CHANNELS };
