import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

export const normalizeUsername = (raw: string): string => {
  return raw.trim().toLowerCase();
};

export const isValidUsername = (username: string): boolean => {
  const norm = normalizeUsername(username);
  return USERNAME_REGEX.test(norm);
};

export const isUsernameAvailable = async (rawUsername: string): Promise<boolean> => {
  const norm = normalizeUsername(rawUsername);
  if (!isValidUsername(norm)) return false;

  const ref = doc(db, 'usernames', norm);
  const snap = await getDoc(ref);
  return !snap.exists();
};

export const claimUsername = async (uid: string, rawUsername: string): Promise<string> => {
  if (!uid || !rawUsername) {
    throw new Error('User ID and username are required.');
  }

  const norm = normalizeUsername(rawUsername);
  if (!isValidUsername(norm)) {
    throw new Error('Username must be 3-30 characters long and contain only lowercase letters, numbers, and underscores.');
  }

  const usernameRef = doc(db, 'usernames', norm);
  const userRef = doc(db, 'users', uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(usernameRef);
    if (snap.exists() && snap.data()?.uid !== uid) {
      throw new Error(`Username '@${norm}' is already taken.`);
    }

    tx.set(usernameRef, {
      uid,
      username: norm,
      createdAt: serverTimestamp(),
    });

    tx.set(userRef, { username: norm, updatedAt: serverTimestamp() }, { merge: true });
  });

  return norm;
};

export const getUidByUsername = async (rawUsername: string): Promise<string | null> => {
  const norm = normalizeUsername(rawUsername);
  try {
    const snap = await getDoc(doc(db, 'usernames', norm));
    if (snap.exists()) {
      return snap.data().uid || null;
    }
  } catch (_) {}
  return null;
};
