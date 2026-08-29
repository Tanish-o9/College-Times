import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { GroupTask } from '../types/groupTask';
import { logGroupActivityEvent } from './groupActivityService';
import { createNotification } from './notificationService';

/**
 * Helper: check if a user is a member of the group.
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
 * Creates a collaborative group task.
 */
export const createGroupTask = async (
  taskData: Omit<GroupTask, 'id' | 'createdAt' | 'createdBy' | 'creatorName'>,
  currentUser: FirebaseUser,
  creatorName: string
): Promise<GroupTask> => {
  if (!currentUser || !taskData.groupId) {
    throw new Error('Authentication and group ID are required.');
  }

  // Authorize creator is group member
  const isMember = await isGroupMember(taskData.groupId, currentUser.uid);
  if (!isMember) {
    throw new Error('Access denied: You must be a group member to create tasks.');
  }

  // Validate assignee is group member if assigned
  if (taskData.assignedTo) {
    const isAssigneeMember = await isGroupMember(taskData.groupId, taskData.assignedTo);
    if (!isAssigneeMember) {
      throw new Error('Assignee must be a member of the group.');
    }
  }

  const tasksRef = collection(db, 'groups', taskData.groupId, 'tasks');
  const fullData: Omit<GroupTask, 'id'> = {
    ...taskData,
    createdBy: currentUser.uid,
    creatorName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(tasksRef, fullData);

  // Log to timeline
  await logGroupActivityEvent(
    taskData.groupId,
    'task',
    currentUser.uid,
    creatorName,
    currentUser.photoURL || undefined,
    docRef.id,
    'task',
    `Created task: "${taskData.title}"`
  );

  // Send assignment notification
  if (taskData.assignedTo && taskData.assignedTo !== currentUser.uid) {
    createNotification({
      recipientId: taskData.assignedTo,
      senderId: currentUser.uid,
      message: `${creatorName} assigned you a group task: "${taskData.title}"`,
      relatedPostId: taskData.groupId,
    }).catch(() => {});
  }

  logAnalyticsEvent('group_task_created', { groupId: taskData.groupId });
  return { id: docRef.id, ...fullData, createdAt: new Date() } as GroupTask;
};

/**
 * Fetches group tasks.
 */
export const getGroupTasks = async (
  groupId: string
): Promise<GroupTask[]> => {
  if (!groupId) return [];
  try {
    const tasksRef = collection(db, 'groups', groupId, 'tasks');
    const q = query(tasksRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupTask);
  } catch (err) {
    console.error('Error fetching group tasks:', err);
    return [];
  }
};

/**
 * Updates a task status or details.
 */
export const updateGroupTask = async (
  groupId: string,
  taskId: string,
  updates: Partial<GroupTask>,
  currentUser: FirebaseUser,
  userName: string
): Promise<void> => {
  if (!groupId || !taskId || !currentUser) return;

  const isMember = await isGroupMember(groupId, currentUser.uid);
  if (!isMember) {
    throw new Error('Access denied: You must be a group member to update tasks.');
  }

  // Validate assignee membership if changed
  if (updates.assignedTo) {
    const isAssigneeMember = await isGroupMember(groupId, updates.assignedTo);
    if (!isAssigneeMember) {
      throw new Error('Assignee must be a member of the group.');
    }
  }

  const taskRef = doc(db, 'groups', groupId, 'tasks', taskId);
  const taskSnap = await getDoc(taskRef);
  if (!taskSnap.exists()) throw new Error('Task not found.');

  const oldTask = taskSnap.data() as GroupTask;

  await updateDoc(taskRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  // Log activity on status change
  if (updates.status && updates.status !== oldTask.status) {
    await logGroupActivityEvent(
      groupId,
      'task',
      currentUser.uid,
      userName,
      currentUser.photoURL || undefined,
      taskId,
      'task',
      `Updated task status to ${updates.status}: "${oldTask.title}"`
    );

    // Notify assignment if status completed
    if (updates.status === 'completed' && oldTask.createdBy !== currentUser.uid) {
      createNotification({
        recipientId: oldTask.createdBy,
        senderId: currentUser.uid,
        message: `${userName} completed task: "${oldTask.title}"`,
        relatedPostId: groupId,
      }).catch(() => {});
    }
  }

  // Notify new assignee
  if (updates.assignedTo && updates.assignedTo !== oldTask.assignedTo && updates.assignedTo !== currentUser.uid) {
    createNotification({
      recipientId: updates.assignedTo,
      senderId: currentUser.uid,
      message: `${userName} assigned you a task: "${oldTask.title}"`,
      relatedPostId: groupId,
    }).catch(() => {});
  }

  logAnalyticsEvent('group_task_updated', { groupId, status: updates.status });
};

/**
 * Deletes a group task.
 */
export const deleteGroupTask = async (
  groupId: string,
  taskId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!groupId || !taskId || !currentUser) return;

  const isMember = await isGroupMember(groupId, currentUser.uid);
  if (!isMember) {
    throw new Error('Access denied: You must be a group member.');
  }

  const taskRef = doc(db, 'groups', groupId, 'tasks', taskId);
  await deleteDoc(taskRef);

  logAnalyticsEvent('group_task_deleted', { groupId, taskId });
};
