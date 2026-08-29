import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, storage, logAnalyticsEvent } from '../lib/firebase';
import { logGroupActivityEvent } from './groupActivityService';

export interface GroupFile {
  id?: string;
  groupId: string;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  storagePath: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: any;
}

/**
 * Helper: checks if a user is a member of the group.
 */
const isGroupMember = async (groupId: string, uid: string): Promise<boolean> => {
  if (!groupId || !uid) return false;
  try {
    const memberRef = doc(db, 'groups', groupId, 'members', uid);
    const snap = await getDoc(memberRef);
    return snap.exists();
  } catch {
    return false;
  }
};

/**
 * Uploads a file to Firebase storage and saves metadata in groups/{groupId}/files.
 * STRICT LIMIT: Files must be less than 10MB.
 */
export const uploadGroupFile = async (
  groupId: string,
  file: File,
  title: string,
  description: string,
  currentUser: FirebaseUser,
  uploadedByName: string
): Promise<GroupFile> => {
  if (!groupId || !currentUser || !file) {
    throw new Error('All upload parameters are required.');
  }

  // Member authorization
  const isMember = await isGroupMember(groupId, currentUser.uid);
  if (!isMember) {
    throw new Error('Access denied: You must be a group member to upload files.');
  }

  // Size limit validation (10MB)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`File '${file.name}' exceeds the 10MB upload limit.`);
  }

  const timestamp = Date.now();
  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `groups/${groupId}/files/${currentUser.uid}/${timestamp}_${cleanName}`;

  // Upload to Firebase Storage
  const fileStorageRef = ref(storage, storagePath);
  await uploadBytes(fileStorageRef, file);
  const downloadUrl = await getDownloadURL(fileStorageRef);

  // Save metadata to Firestore
  const filesRef = collection(db, 'groups', groupId, 'files');
  const metadata: Omit<GroupFile, 'id'> = {
    groupId,
    title: title.trim().slice(0, 100) || file.name,
    description: description.trim().slice(0, 300),
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    downloadUrl,
    storagePath,
    uploadedBy: currentUser.uid,
    uploadedByName,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(filesRef, metadata);

  // Log to timeline
  await logGroupActivityEvent(
    groupId,
    'file_shared',
    currentUser.uid,
    uploadedByName,
    currentUser.photoURL || undefined,
    docRef.id,
    'file',
    `Shared file: "${file.name}"`
  );

  logAnalyticsEvent('group_file_uploaded', { groupId });
  return { id: docRef.id, ...metadata, createdAt: new Date() } as GroupFile;
};

/**
 * Fetches shared files list for a group.
 */
export const getGroupFiles = async (
  groupId: string
): Promise<GroupFile[]> => {
  if (!groupId) return [];
  try {
    const filesRef = collection(db, 'groups', groupId, 'files');
    const q = query(filesRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupFile);
  } catch (err) {
    console.error('Error fetching group files:', err);
    return [];
  }
};

/**
 * Deletes a shared group file.
 */
export const deleteGroupFile = async (
  groupId: string,
  fileId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!groupId || !fileId || !currentUser) return;

  const fileRef = doc(db, 'groups', groupId, 'files', fileId);
  const snap = await getDoc(fileRef);
  if (!snap.exists()) throw new Error('File metadata not found.');

  const fileData = snap.data() as GroupFile;

  // Authorization: original uploader only (or admin)
  if (fileData.uploadedBy !== currentUser.uid) {
    // Check group manager role
    const memberRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
    const memberSnap = await getDoc(memberRef);
    const userRole = memberSnap.exists() ? memberSnap.data().role : null;
    const isManager = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator';
    if (!isManager) {
      throw new Error('Access denied: Only the uploader or group managers can delete files.');
    }
  }

  // Delete from Storage
  try {
    const fileStorageRef = ref(storage, fileData.storagePath);
    await deleteObject(fileStorageRef);
  } catch (err) {
    console.warn('Could not delete binary from Storage, continuing metadata deletion:', err);
  }

  // Delete from Firestore
  await deleteDoc(fileRef);

  logAnalyticsEvent('group_file_deleted', { groupId, fileId });
};
