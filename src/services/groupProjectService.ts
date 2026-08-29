import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logGroupActivityEvent } from './groupActivityService';

export interface GroupProject {
  id?: string;
  name: string;
  description: string;
  groupId: string;
  ownerId: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  createdAt?: any;
  updatedAt?: any;
}

export interface ProjectMember {
  uid: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt?: any;
}

export interface ProjectTask {
  id?: string;
  title: string;
  description?: string;
  assignedTo?: string; // userId
  assignedToName?: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'normal' | 'high';
  deadline?: any;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Creates a project workspace under projects/{projectId}
 */
export const createGroupProject = async (
  groupId: string,
  ownerId: string,
  name: string,
  description: string
): Promise<string> => {
  if (!groupId || !ownerId) throw new Error('Group ID and Owner ID are required.');

  // Create Project Doc
  const projectsColl = collection(db, 'projects');
  const projectDoc = await addDoc(projectsColl, {
    name,
    description,
    groupId,
    ownerId,
    status: 'planning',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Create Project Owner Member
  const memberDoc = doc(db, 'projects', projectDoc.id, 'members', ownerId);
  await updateDoc(memberDoc, {
    uid: ownerId,
    role: 'owner',
    joinedAt: serverTimestamp(),
  }).catch(async () => {
    // If doc doesn't exist, we can setDoc it. But updateDoc might fail.
    // Let's use setDoc / doc reference with set
    const { setDoc } = await import('firebase/firestore');
    await setDoc(memberDoc, {
      uid: ownerId,
      role: 'owner',
      joinedAt: serverTimestamp(),
    });
  });

  return projectDoc.id;
};

/**
 * Fetches all projects assigned to a group
 */
export const getGroupProjects = async (groupId: string): Promise<GroupProject[]> => {
  if (!groupId) return [];
  try {
    const projectsColl = collection(db, 'projects');
    const q = query(projectsColl, where('groupId', '==', groupId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as GroupProject));
  } catch (err) {
    console.error('Failed to get group projects:', err);
    return [];
  }
};

/**
 * Creates a project task under projects/{projectId}/tasks/{taskId}
 */
export const createProjectTask = async (
  projectId: string,
  task: Omit<ProjectTask, 'id'>
): Promise<string> => {
  if (!projectId) throw new Error('Project ID is required.');
  const tasksColl = collection(db, 'projects', projectId, 'tasks');
  const docRef = await addDoc(tasksColl, {
    ...task,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Updates a project task.
 * Awards contribution points if task status transitions to 'completed'.
 */
export const updateProjectTask = async (
  groupId: string,
  projectId: string,
  taskId: string,
  updates: Partial<ProjectTask>,
  actorId: string,
  actorName: string
): Promise<void> => {
  if (!projectId || !taskId) throw new Error('Project ID and Task ID are required.');

  const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
  const taskSnap = await getDoc(taskRef);

  if (!taskSnap.exists()) throw new Error('Task not found.');
  const prevStatus = taskSnap.data().status;

  await updateDoc(taskRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  // Award points if task is completed
  if (updates.status === 'completed' && prevStatus !== 'completed') {
    await logGroupActivityEvent(
      groupId,
      'task',
      actorId,
      actorName,
      undefined,
      taskId,
      'task',
      `Completed project task: ${updates.title || taskSnap.data().title}`
    );
  }
};

/**
 * Deletes a project task
 */
export const deleteProjectTask = async (projectId: string, taskId: string): Promise<void> => {
  if (!projectId || !taskId) throw new Error('Project ID and Task ID are required.');
  const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
  await deleteDoc(taskRef);
};

/**
 * Fetches all tasks of a project
 */
export const getProjectTasks = async (projectId: string): Promise<ProjectTask[]> => {
  if (!projectId) return [];
  try {
    const tasksColl = collection(db, 'projects', projectId, 'tasks');
    const q = query(tasksColl, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as ProjectTask));
  } catch (err) {
    console.error('Failed to get project tasks:', err);
    return [];
  }
};
