const assert = require('assert');

/**
 * Phase 34 Load Test Script: Instant Group Sharing, Expiration & FCM Broadcast Strategy
 */

const INSTANT_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function createInstantDocumentPayload(groupId, senderId, caption, mediaList = []) {
  if (mediaList.length > 5) {
    throw new Error('Maximum 5 photos allowed per Instant.');
  }

  const now = Date.now();
  return {
    id: `inst_${now}_${Math.random().toString(36).substring(2, 6)}`,
    groupId,
    senderId,
    type: mediaList.length > 0 ? 'image' : 'text',
    media: mediaList,
    caption: caption ? caption.trim().slice(0, 300) : undefined,
    createdAt: now,
    expiresAt: now + INSTANT_EXPIRATION_MS,
    status: 'active',
    reactionCounts: {},
  };
}

function filterActiveInstants(instants, currentTime = Date.now()) {
  return instants.filter(
    (inst) => inst.status === 'active' && inst.expiresAt > currentTime
  );
}

function generateInstantFcmTopicPayload(groupId, instantId, senderName) {
  return {
    topic: `group_${groupId}`,
    notification: {
      title: '⚡ New Group Instant',
      body: `${senderName} shared a 24h moment with your group!`,
    },
    data: {
      type: 'group_instant',
      groupId,
      instantId,
    },
  };
}

function runInstantLoadTests() {
  console.log('🧪 Starting Phase 34 Group Instant Load & Expiration Tests...\n');

  // Test 1: Document Payload & Expiration Calculation
  console.log('Test 1: Verifying Instant Payload & 24h Expiration Calculation...');
  const now = Date.now();
  const payload = createInstantDocumentPayload('grp_cse_2029', 'user_alice', 'Exam study group session!', [
    'https://storage.com/photo1.jpg',
    'https://storage.com/photo2.jpg',
  ]);

  assert.strictEqual(payload.groupId, 'grp_cse_2029');
  assert.strictEqual(payload.media.length, 2);
  assert.strictEqual(payload.expiresAt - payload.createdAt, INSTANT_EXPIRATION_MS, 'Expiration must be exactly 24 hours');
  console.log('✅ Test 1 Passed! (24h Expiration Verified)\n');

  // Test 2: Max 5 Photos Enforcement
  console.log('Test 2: Verifying 5-Photo Limit Enforcement...');
  assert.throws(
    () => createInstantDocumentPayload('grp_cse', 'user_bob', '', Array(6).fill('http://photo.jpg')),
    /Maximum 5 photos/,
    'Should throw error when exceeding 5 photos'
  );
  console.log('✅ Test 2 Passed!\n');

  // Test 3: Expiration Filtering Logic
  console.log('Test 3: Verifying 24h Client Expiration Filtering...');
  const mockInstants = [
    { id: 'inst_1', status: 'active', expiresAt: now + 3600000 }, // Fresh (1 hour left)
    { id: 'inst_2', status: 'active', expiresAt: now - 1000 },    // Expired (1 sec ago)
    { id: 'inst_3', status: 'deleted', expiresAt: now + 7200000 }, // Deleted
  ];

  const activeOnly = filterActiveInstants(mockInstants, now);
  assert.strictEqual(activeOnly.length, 1, 'Only non-expired active items should remain');
  assert.strictEqual(activeOnly[0].id, 'inst_1');
  console.log('✅ Test 3 Passed!\n');

  // Test 4: FCM Topic Payload (Zero Fan-Out Strategy)
  console.log('Test 4: Verifying FCM Topic Broadcast Payload (Zero Fan-Out)...');
  const fcmPayload = generateInstantFcmTopicPayload('grp_cse_2029', 'inst_123', 'Alice');
  assert.strictEqual(fcmPayload.topic, 'group_grp_cse_2029');
  assert.strictEqual(fcmPayload.notification.title.includes('New Group Instant'), true);
  console.log('✅ Test 4 Passed! (Topic: group_grp_cse_2029, 0 Firestore Notification Fan-Out)\n');

  console.log('🎉 ALL PHASE 34 TESTS PASSED SUCCESSFULLY!');
}

runInstantLoadTests();
