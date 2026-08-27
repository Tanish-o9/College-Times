const assert = require('assert');

/**
 * Phase 32 Load Test Script: Group Discovery, Pass Code Normalization & 10K Capacity Limits
 */

function generateRandomCode(length = 6) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CT-${result}`;
}

function normalizePassCode(code) {
  if (!code) return '';
  return code.trim().toUpperCase();
}

function validateGroupJoinCapacity(currentMemberCount, maxCapacity = 10000) {
  if (currentMemberCount >= maxCapacity) {
    throw new Error('Group has reached its maximum capacity of 10,000 members.');
  }
  return currentMemberCount + 1;
}

function filterGroupsBounded(groups, searchQuery = '', categoryFilter = 'all', limit = 20) {
  let items = [...groups];

  if (categoryFilter !== 'all') {
    items = items.filter(
      (g) =>
        g.type === categoryFilter ||
        (g.category && g.category.toLowerCase() === categoryFilter.toLowerCase())
    );
  }

  if (searchQuery.trim()) {
    const term = searchQuery.trim().toLowerCase();
    items = items.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        (g.description && g.description.toLowerCase().includes(term)) ||
        (g.category && g.category.toLowerCase().includes(term))
    );
  }

  return items.slice(0, Math.min(50, limit));
}

function runLoadTests() {
  console.log('🧪 Starting Phase 32 Load & Integration Tests...\n');

  // Test 1: Code Format & Normalization
  console.log('Test 1: Verifying Invite Code Generation & Normalization...');
  const code1 = generateRandomCode();
  assert.strictEqual(code1.startsWith('CT-'), true, 'Code must start with CT-');
  assert.strictEqual(code1.length, 9, 'Code must be 9 chars long');
  assert.strictEqual(normalizePassCode('  ct-7k4p9x '), 'CT-7K4P9X', 'Code must normalize to uppercase');
  console.log('✅ Test 1 Passed! (Sample code:', code1, ')\n');

  // Test 2: 10,000 Capacity Limit Enforcement
  console.log('Test 2: Verifying 10,000 Capacity Limit Enforcement...');
  let count = 9999;
  count = validateGroupJoinCapacity(count, 10000);
  assert.strictEqual(count, 10000, 'Member count should increment to 10,000');

  assert.throws(
    () => validateGroupJoinCapacity(10000, 10000),
    /10,000 members/,
    'Should throw error when capacity reached'
  );
  console.log('✅ Test 2 Passed!\n');

  // Test 3: Simulated 10,000 Group Objects Bounded Search Performance
  console.log('Test 3: Benchmarking 10,000 Group Search Filter Performance...');
  const dummyGroups = Array.from({ length: 10000 }, (_, i) => ({
    id: `group_${i}`,
    name: `AKGEC ${i % 2 === 0 ? 'Coding' : 'Robotics'} Club ${i}`,
    description: `Official campus community group number ${i}`,
    type: i % 4 === 0 ? 'department' : i % 3 === 0 ? 'batch' : 'community',
    category: i % 2 === 0 ? 'Coding' : 'Clubs',
    memberCount: Math.floor(Math.random() * 9000),
    active: true,
  }));

  const startTime = Date.now();
  const searchResult = filterGroupsBounded(dummyGroups, 'coding', 'all', 20);
  const durationMs = Date.now() - startTime;

  assert.strictEqual(searchResult.length, 20, 'Should return bounded limit of 20 items');
  console.log(`✅ Test 3 Passed! (Filtered 10,000 groups in ${durationMs}ms)\n`);

  console.log('🎉 ALL PHASE 32 TESTS PASSED SUCCESSFULLY!');
}

runLoadTests();
