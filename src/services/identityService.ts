import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface VerificationRequest {
  id?: string;
  userId: string;
  userDisplayName: string;
  collegeEmail: string;
  departmentId: string;
  batchYear: number;
  idImageUrl?: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export const createVerificationRequest = async (
  userId: string,
  userDisplayName: string,
  request: { collegeEmail: string; departmentId: string; batchYear: number; idImageUrl?: string }
): Promise<string> => {
  const colRef = collection(db, 'verificationRequests');
  const docRef = await addDoc(colRef, {
    ...request,
    userId,
    userDisplayName,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Update user profile status to pending
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    verificationStatus: 'pending',
  });

  return docRef.id;
};

export const getPendingVerificationRequests = async (): Promise<VerificationRequest[]> => {
  try {
    const colRef = collection(db, 'verificationRequests');
    const q = query(colRef, where('status', '==', 'pending'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VerificationRequest));
  } catch (err) {
    console.error('Error getting pending verifications:', err);
    return [];
  }
};

export const approveVerificationRequest = async (requestId: string): Promise<void> => {
  const reqRef = doc(db, 'verificationRequests', requestId);

  await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error('Verification request not found.');

    const reqData = reqSnap.data() as VerificationRequest;
    if (reqData.status !== 'pending') throw new Error('Request already processed.');

    // 1. Mark request as verified
    tx.update(reqRef, {
      status: 'verified',
      updatedAt: serverTimestamp(),
    });

    // 2. Set User profile fields
    const userRef = doc(db, 'users', reqData.userId);
    tx.update(userRef, {
      isVerified: true,
      collegeEmail: reqData.collegeEmail,
      departmentId: reqData.departmentId,
      batchYear: reqData.batchYear,
      verificationStatus: 'verified',
    });
  });
};

export const rejectVerificationRequest = async (requestId: string, reason: string): Promise<void> => {
  const reqRef = doc(db, 'verificationRequests', requestId);

  await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error('Verification request not found.');

    const reqData = reqSnap.data() as VerificationRequest;
    if (reqData.status !== 'pending') throw new Error('Request already processed.');

    // 1. Mark request as rejected
    tx.update(reqRef, {
      status: 'rejected',
      rejectionReason: reason.trim(),
      updatedAt: serverTimestamp(),
    });

    // 2. Update User profile verificationStatus
    const userRef = doc(db, 'users', reqData.userId);
    tx.update(userRef, {
      verificationStatus: 'rejected',
    });
  });
};
