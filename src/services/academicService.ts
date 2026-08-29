import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  runTransaction,
  increment,
  updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Subject {
  id?: string;
  name: string;
  code: string;
  department: string;
  semester: number;
  batch: string;
}

export interface StudyNote {
  id?: string;
  title: string;
  link: string;
  uploaderId: string;
  uploaderName: string;
  semester: number;
  tags: string[];
  bookmarkCount: number;
  rating: number;
  ratingCount: number;
  createdAt: any;
}

export interface DoubtQuestion {
  id?: string;
  title: string;
  content: string;
  uploaderId: string;
  uploaderName: string;
  upvotes: number;
  upvotedBy?: string[];
  acceptedAnswerId?: string;
  createdAt: any;
}

export interface DoubtAnswer {
  id?: string;
  text: string;
  uploaderId: string;
  uploaderName: string;
  createdAt: any;
}

export interface UserAssignment {
  id?: string;
  title: string;
  subjectCode: string;
  deadline: number; // millisecond timestamp
  status: 'pending' | 'completed';
  createdAt: any;
}

/**
 * Fetches all academic subjects, seeds default ones if collection is empty.
 */
export const getSubjectsList = async (): Promise<Subject[]> => {
  try {
    const colRef = collection(db, 'subjects');
    const snap = await getDocs(colRef);
    let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject));

    if (list.length === 0) {
      // Seed default courses
      const seedSubjects: Subject[] = [
        { name: 'Data Structures & Algorithms', code: 'CS-201', department: 'Computer Science', semester: 3, batch: '2028' },
        { name: 'Database Management Systems', code: 'CS-302', department: 'Computer Science', semester: 4, batch: '2028' },
        { name: 'Computer Networks', code: 'CS-304', department: 'Computer Science', semester: 5, batch: '2027' },
        { name: 'Operating Systems', code: 'CS-202', department: 'Computer Science', semester: 4, batch: '2028' }
      ];

      for (const sub of seedSubjects) {
        const docRef = await addDoc(colRef, sub);
        list.push({ id: docRef.id, ...sub });
      }
    }

    return list;
  } catch (err) {
    console.error('Failed to get subjects:', err);
    return [];
  }
};

/**
 * Study Notes management under subjects/{subjectId}/resources
 */
export const addStudyNote = async (
  subjectId: string,
  note: Omit<StudyNote, 'id' | 'createdAt' | 'bookmarkCount' | 'rating' | 'ratingCount'>
): Promise<string> => {
  const colRef = collection(db, 'subjects', subjectId, 'resources');
  const docRef = await addDoc(colRef, {
    ...note,
    bookmarkCount: 0,
    rating: 5.0,
    ratingCount: 1,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getSubjectNotes = async (subjectId: string): Promise<StudyNote[]> => {
  try {
    const colRef = collection(db, 'subjects', subjectId, 'resources');
    const snap = await getDocs(query(colRef, orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudyNote));
  } catch {
    return [];
  }
};

/**
 * Doubt Clearing Questions board under subjects/{subjectId}/questions
 */
export const askDoubtQuestion = async (
  subjectId: string,
  title: string,
  content: string,
  uploaderId: string,
  uploaderName: string
): Promise<string> => {
  const colRef = collection(db, 'subjects', subjectId, 'questions');
  const docRef = await addDoc(colRef, {
    title: title.trim(),
    content: content.trim(),
    uploaderId,
    uploaderName,
    upvotes: 0,
    upvotedBy: [],
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getSubjectQuestions = async (subjectId: string): Promise<DoubtQuestion[]> => {
  try {
    const colRef = collection(db, 'subjects', subjectId, 'questions');
    const snap = await getDocs(query(colRef, orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DoubtQuestion));
  } catch {
    return [];
  }
};

export const upvoteQuestion = async (
  subjectId: string,
  questionId: string,
  userId: string
): Promise<void> => {
  const docRef = doc(db, 'subjects', subjectId, 'questions', questionId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists()) return;

    const data = snap.data() as DoubtQuestion;
    const upvoted = data.upvotedBy || [];

    if (upvoted.includes(userId)) {
      // Undo upvote
      tx.update(docRef, {
        upvotes: increment(-1),
        upvotedBy: upvoted.filter((id) => id !== userId),
      });
    } else {
      // Upvote
      tx.update(docRef, {
        upvotes: increment(1),
        upvotedBy: [...upvoted, userId],
      });
    }
  });
};

/**
 * Answers under subjects/{subjectId}/questions/{questionId}/answers
 */
export const answerDoubtQuestion = async (
  subjectId: string,
  questionId: string,
  text: string,
  uploaderId: string,
  uploaderName: string
): Promise<string> => {
  const colRef = collection(db, 'subjects', subjectId, 'questions', questionId, 'answers');
  const docRef = await addDoc(colRef, {
    text: text.trim(),
    uploaderId,
    uploaderName,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getQuestionAnswers = async (subjectId: string, questionId: string): Promise<DoubtAnswer[]> => {
  try {
    const colRef = collection(db, 'subjects', subjectId, 'questions', questionId, 'answers');
    const snap = await getDocs(query(colRef, orderBy('createdAt', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DoubtAnswer));
  } catch {
    return [];
  }
};

export const markAcceptedAnswer = async (
  subjectId: string,
  questionId: string,
  answerId: string
): Promise<void> => {
  const docRef = doc(db, 'subjects', subjectId, 'questions', questionId);
  await updateDoc(docRef, {
    acceptedAnswerId: answerId,
  });
};

/**
 * Assignment Tracker under users/{uid}/assignments
 */
export const getUserAssignments = async (userId: string): Promise<UserAssignment[]> => {
  try {
    const colRef = collection(db, 'users', userId, 'assignments');
    const snap = await getDocs(query(colRef, orderBy('deadline', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserAssignment));
  } catch {
    return [];
  }
};

export const createUserAssignment = async (
  userId: string,
  assignment: Omit<UserAssignment, 'id' | 'createdAt' | 'status'>
): Promise<string> => {
  const colRef = collection(db, 'users', userId, 'assignments');
  const docRef = await addDoc(colRef, {
    ...assignment,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateAssignmentStatus = async (
  userId: string,
  assignmentId: string,
  status: 'pending' | 'completed'
): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'assignments', assignmentId);
  await updateDoc(docRef, {
    status,
  });
};

export interface NoteVersion {
  id?: string;
  versionNumber: number;
  link: string;
  changelog: string;
  uploaderId: string;
  uploaderName: string;
  createdAt: any;
}

/**
 * Adds a new version to a study note.
 */
export const addNoteVersion = async (
  subjectId: string,
  noteId: string,
  version: Omit<NoteVersion, 'id' | 'createdAt' | 'versionNumber'>
): Promise<string> => {
  const versionsCol = collection(db, 'subjects', subjectId, 'resources', noteId, 'versions');
  const snap = await getDocs(versionsCol);
  const versionNumber = snap.size + 1;

  const docRef = await addDoc(versionsCol, {
    ...version,
    versionNumber,
    createdAt: serverTimestamp(),
  });

  // Update primary note link to the latest version
  const noteRef = doc(db, 'subjects', subjectId, 'resources', noteId);
  await updateDoc(noteRef, {
    link: version.link,
  });

  return docRef.id;
};

/**
 * Fetches all versions of a study note.
 */
export const getNoteVersions = async (subjectId: string, noteId: string): Promise<NoteVersion[]> => {
  try {
    const versionsCol = collection(db, 'subjects', subjectId, 'resources', noteId, 'versions');
    const snap = await getDocs(query(versionsCol, orderBy('versionNumber', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as NoteVersion));
  } catch {
    return [];
  }
};
