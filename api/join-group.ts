import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseServices } from './_firebase';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

const MAX_GROUP_CAPACITY = 10000;

const hashStringSHA256 = (str: string): string => {
  return crypto.createHash('sha256').update(str).digest('hex');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    const { db, auth } = getFirebaseServices();

    // Verify authenticated user via Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const { groupId, passcode } = req.body || {};
    if (!groupId || typeof groupId !== 'string') {
      res.status(400).json({ error: 'Group ID is required.' });
      return;
    }

    const trimmedPasscode = typeof passcode === 'string' ? passcode.trim() : '';

    // Atomically verify and join group via Firestore Admin SDK
    const groupRef = db.collection('groups').doc(groupId);
    const memberRef = groupRef.collection('members').doc(uid);
    const userMembershipRef = db.collection('users').doc(uid).collection('groupMemberships').doc(groupId);
    const banRef = groupRef.collection('bannedMembers').doc(uid);

    let groupName = 'Campus Group';

    await db.runTransaction(async (transaction) => {
      const groupSnap = await transaction.get(groupRef);
      if (!groupSnap.exists) {
        throw { status: 404, message: 'Group not found.' };
      }

      const groupData = groupSnap.data() || {};
      if (!groupData.active) {
        throw { status: 400, message: 'Group is currently unavailable for new members.' };
      }

      groupName = groupData.name || 'Campus Group';

      const banSnap = await transaction.get(banRef);
      if (banSnap.exists) {
        throw { status: 403, message: 'Access denied: You are banned from joining this group.' };
      }

      // Check passcode / password verification
      const hasGroupPassword = Boolean(groupData.hasPassword || groupData.passcodeHash || groupData.passcode);
      if (hasGroupPassword) {
        if (!trimmedPasscode) {
          throw { status: 400, message: 'This group is password-protected. Please enter the passcode.' };
        }

        const enteredHash = hashStringSHA256(trimmedPasscode);
        const enteredHashLower = hashStringSHA256(trimmedPasscode.toLowerCase());
        const isMatch =
          (groupData.passcodeHash && (enteredHash === groupData.passcodeHash || enteredHashLower === groupData.passcodeHash)) ||
          (groupData.passcode && trimmedPasscode.toLowerCase() === String(groupData.passcode).trim().toLowerCase()) ||
          (groupData.inviteCodePlaintext && trimmedPasscode.toUpperCase() === groupData.inviteCodePlaintext.trim().toUpperCase()) ||
          (groupData.inviteCodeHash && trimmedPasscode.toUpperCase() === groupData.inviteCodeHash.trim().toUpperCase());

        if (!isMatch) {
          throw { status: 400, message: 'Incorrect group passcode.' };
        }
      } else if (groupData.visibility === 'private') {
        const isCodeMatch =
          !trimmedPasscode ||
          (groupData.inviteCodePlaintext && trimmedPasscode.toUpperCase() === groupData.inviteCodePlaintext.trim().toUpperCase()) ||
          (groupData.inviteCodeHash && trimmedPasscode.toUpperCase() === groupData.inviteCodeHash.trim().toUpperCase());

        if (!isCodeMatch) {
          throw { status: 400, message: 'This group is private. Please join using a valid invite pass code.' };
        }
      }

      const currentCount = groupData.memberCount || 0;
      if (currentCount >= MAX_GROUP_CAPACITY) {
        throw { status: 400, message: 'Group has reached its maximum capacity of 10,000 members.' };
      }

      const memberSnap = await transaction.get(memberRef);
      if (memberSnap.exists) {
        throw { status: 400, message: "You're already a member of this group." };
      }

      // Fetch user profile for display name & photo
      const userDocRef = db.collection('users').doc(uid);
      const userSnap = await transaction.get(userDocRef);
      const userData = userSnap.data() || {};

      const memberData = {
        uid,
        role: 'member',
        joinedAt: FieldValue.serverTimestamp(),
        points: 0,
        ...(userData.displayName ? { displayName: userData.displayName } : {}),
        ...(userData.photoURL ? { photoURL: userData.photoURL } : {}),
      };

      const userLookupData = {
        groupId,
        joinedAt: FieldValue.serverTimestamp(),
      };

      transaction.set(memberRef, memberData);
      transaction.set(userMembershipRef, userLookupData);
      transaction.update(groupRef, {
        memberCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Add group activity timeline event
      const activityRef = groupRef.collection('activity').doc();
      transaction.set(activityRef, {
        groupId,
        type: 'membership_change',
        actorId: uid,
        actorName: userData.displayName || 'Student',
        ...(userData.photoURL ? { actorAvatar: userData.photoURL } : {}),
        preview: 'joined the group',
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    res.status(200).json({
      success: true,
      groupId,
      groupName,
    });
  } catch (error: any) {
    if (error && typeof error === 'object' && error.status && error.message) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('[API JOIN GROUP ERROR]', error?.message || error);
    res.status(500).json({ error: 'Unable to join this group right now. Please try again.' });
  }
}
