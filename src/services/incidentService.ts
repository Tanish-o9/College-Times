import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type {
  Incident,
  IncidentStatus,
  IncidentSeverity,
  IncidentCategory,
  AffectedArea,
  IncidentUpdate,
} from '../types/incident';

/**
 * Validates status transitions for the Incident state machine.
 */
export const isValidStatusTransition = (
  currentStatus: IncidentStatus,
  newStatus: IncidentStatus
): boolean => {
  if (currentStatus === newStatus) return true;
  if (currentStatus === 'resolved' || currentStatus === 'dismissed') return false;

  switch (currentStatus) {
    case 'reported':
      return newStatus === 'verifying' || newStatus === 'dismissed';
    case 'verifying':
      return newStatus === 'active' || newStatus === 'dismissed';
    case 'active':
      return newStatus === 'monitoring' || newStatus === 'resolved';
    case 'monitoring':
      return newStatus === 'active' || newStatus === 'resolved';
    default:
      return false;
  }
};

/**
 * Audience eligibility check for active incidents.
 */
export const isUserEligibleForIncident = (
  incident: Incident,
  userProfile?: User | null,
  joinedGroupIds: string[] = []
): boolean => {
  if (!incident) return false;
  if (incident.affectedArea === 'campus') return true;

  if (incident.affectedArea === 'department') {
    if (!userProfile?.departmentId || !incident.affectedAreaId) return false;
    return userProfile.departmentId.toLowerCase() === incident.affectedAreaId.toLowerCase();
  }

  if (incident.affectedArea === 'batch') {
    if (!userProfile?.batchYear || !incident.affectedAreaId) return false;
    return String(userProfile.batchYear) === String(incident.affectedAreaId);
  }

  if (incident.affectedArea === 'community') {
    if (!incident.affectedAreaId) return false;
    return joinedGroupIds.includes(incident.affectedAreaId);
  }

  return true;
};

/**
 * Admin Action: Creates a new campus incident document.
 */
export const createIncident = async (
  data: {
    title: string;
    summary: string;
    category: IncidentCategory;
    severity: IncidentSeverity;
    locationName: string;
    locationLat?: number;
    locationLng?: number;
    affectedArea: AffectedArea;
    affectedAreaId?: string;
    emergencyInstructions?: string;
  },
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<string> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to create incident.');
  }

  if (!data.title || data.title.trim().length > 100) {
    throw new Error('Title is required and must be 100 characters or fewer.');
  }
  if (!data.summary || data.summary.trim().length > 500) {
    throw new Error('Summary is required and must be 500 characters or fewer.');
  }
  if (!data.locationName || data.locationName.trim().length > 150) {
    throw new Error('Location is required and must be 150 characters or fewer.');
  }
  if (data.emergencyInstructions && data.emergencyInstructions.trim().length > 500) {
    throw new Error('Emergency instructions must be 500 characters or fewer.');
  }
  if (data.locationLat !== undefined && (data.locationLat < -90 || data.locationLat > 90)) {
    throw new Error('Invalid latitude coordinates.');
  }
  if (data.locationLng !== undefined && (data.locationLng < -180 || data.locationLng > 180)) {
    throw new Error('Invalid longitude coordinates.');
  }

  const colRef = collection(db, 'incidents');
  const newDocRef = doc(colRef);

  const incidentDoc: Omit<Incident, 'id'> = {
    title: data.title.trim(),
    summary: data.summary.trim(),
    category: data.category,
    severity: data.severity,
    status: 'reported',
    locationName: data.locationName.trim(),
    ...(data.locationLat !== undefined ? { locationLat: data.locationLat } : {}),
    ...(data.locationLng !== undefined ? { locationLng: data.locationLng } : {}),
    affectedArea: data.affectedArea,
    ...(data.affectedAreaId ? { affectedAreaId: data.affectedAreaId } : {}),
    ...(data.emergencyInstructions ? { emergencyInstructions: data.emergencyInstructions.trim() } : {}),
    createdBy: currentUser.uid,
    createdByName: (userProfile as any)?.name || userProfile?.displayName || currentUser.displayName || 'Admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(newDocRef, incidentDoc);

  // Log Audit Action
  const auditRef = doc(collection(db, 'adminAuditLogs'));
  await setDoc(auditRef, {
    actorId: currentUser.uid,
    actorName: (userProfile as any)?.name || userProfile?.displayName || 'Admin',
    action: 'INCIDENT_CREATED',
    resourceType: 'alert',
    targetId: newDocRef.id,
    timestamp: serverTimestamp(),
    metadata: { title: data.title, category: data.category, severity: data.severity },
  });

  return newDocRef.id;
};

/**
 * Admin Action: Verifies an incident (reported -> verifying).
 */
export const verifyIncident = async (
  incidentId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to verify incident.');
  }

  const incidentRef = doc(db, 'incidents', incidentId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(incidentRef);
    if (!snap.exists()) throw new Error('Incident not found.');

    const curr = snap.data() as Incident;
    if (!isValidStatusTransition(curr.status, 'verifying')) {
      throw new Error(`Cannot verify incident in status '${curr.status}'.`);
    }

    transaction.update(incidentRef, {
      status: 'verifying',
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const auditRef = doc(collection(db, 'adminAuditLogs'));
  await setDoc(auditRef, {
    actorId: currentUser.uid,
    actorName: (userProfile as any)?.name || userProfile?.displayName || 'Admin',
    action: 'INCIDENT_VERIFIED',
    resourceType: 'alert',
    targetId: incidentId,
    timestamp: serverTimestamp(),
  });
};

/**
 * Admin Action: Updates status of an incident according to state machine rules.
 */
export const updateIncidentStatus = async (
  incidentId: string,
  newStatus: IncidentStatus,
  currentIncident: Incident,
  currentUser: FirebaseUser,
  userProfile?: User | null,
  resolutionSummary?: string
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to update incident status.');
  }

  if (!isValidStatusTransition(currentIncident.status, newStatus)) {
    throw new Error(`Invalid status transition from '${currentIncident.status}' to '${newStatus}'.`);
  }

  const incidentRef = doc(db, 'incidents', incidentId);
  const updates: Partial<Incident> = {
    status: newStatus,
    updatedAt: serverTimestamp() as any,
  };

  if (newStatus === 'resolved') {
    updates.resolvedAt = serverTimestamp() as any;
    if (resolutionSummary) updates.resolutionSummary = resolutionSummary.trim();
  }

  await updateDoc(incidentRef, updates);

  // If incident becomes active & is HIGH/CRITICAL, create/update activeAlert index
  if (newStatus === 'active' && (currentIncident.severity === 'high' || currentIncident.severity === 'critical')) {
    const activeAlertRef = doc(db, 'activeAlerts', incidentId);
    await setDoc(
      activeAlertRef,
      {
        postId: incidentId,
        audienceType: currentIncident.affectedArea === 'building' ? 'campus' : currentIncident.affectedArea,
        audienceId: currentIncident.affectedAreaId,
        priority: currentIncident.severity === 'critical' ? 'emergency' : 'important',
        title: currentIncident.title,
        active: true,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      },
      { merge: true }
    );
  }

  // Audit Log
  const auditAction =
    newStatus === 'resolved'
      ? 'INCIDENT_RESOLVED'
      : newStatus === 'dismissed'
      ? 'INCIDENT_DISMISSED'
      : 'INCIDENT_STATUS_CHANGED';

  const auditRef = doc(collection(db, 'adminAuditLogs'));
  await setDoc(auditRef, {
    actorId: currentUser.uid,
    actorName: (userProfile as any)?.name || userProfile?.displayName || 'Admin',
    action: auditAction,
    resourceType: 'alert',
    targetId: incidentId,
    timestamp: serverTimestamp(),
    metadata: { newStatus, resolutionSummary },
  });
};

/**
 * Admin Action: Escalates incident severity (e.g., high -> critical).
 */
export const escalateIncidentSeverity = async (
  incidentId: string,
  newSeverity: IncidentSeverity,
  currentIncident: Incident,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to escalate severity.');
  }

  const incidentRef = doc(db, 'incidents', incidentId);
  await updateDoc(incidentRef, {
    severity: newSeverity,
    updatedAt: serverTimestamp(),
  });

  const auditRef = doc(collection(db, 'adminAuditLogs'));
  await setDoc(auditRef, {
    actorId: currentUser.uid,
    actorName: (userProfile as any)?.name || userProfile?.displayName || 'Admin',
    action: 'INCIDENT_ESCALATED',
    resourceType: 'alert',
    targetId: incidentId,
    timestamp: serverTimestamp(),
    metadata: { previousSeverity: currentIncident.severity, newSeverity },
  });
};

/**
 * Admin Action: Adds a status update to an incident timeline.
 */
export const addIncidentUpdate = async (
  incidentId: string,
  message: string,
  status: IncidentStatus,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to add incident update.');
  }

  if (!message || message.trim().length > 300) {
    throw new Error('Update message is required and must be 300 characters or fewer.');
  }

  const updatesCol = collection(db, 'incidents', incidentId, 'updates');
  const updateDoc: Omit<IncidentUpdate, 'id'> = {
    incidentId,
    message: message.trim(),
    status,
    createdBy: currentUser.uid,
    createdByName: (userProfile as any)?.name || userProfile?.displayName || 'Admin',
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(updatesCol), updateDoc);
};

/**
 * Real-time bounded snapshot listener for live incident updates.
 */
export const subscribeToIncidentUpdates = (
  incidentId: string,
  onUpdatesChange: (updates: IncidentUpdate[]) => void
): Unsubscribe => {
  if (!incidentId) {
    onUpdatesChange([]);
    return () => {};
  }

  const colRef = collection(db, 'incidents', incidentId, 'updates');
  const q = query(colRef, orderBy('createdAt', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        ...(d.data() as IncidentUpdate),
        id: d.id,
      }));
      onUpdatesChange(items);
    },
    (err) => {
      console.error(`Error subscribing to updates for ${incidentId}:`, err);
      onUpdatesChange([]);
    }
  );
};

/**
 * Bounded snapshot listener for active campus incidents.
 */
export const subscribeToActiveIncidents = (
  currentUser: FirebaseUser | null,
  userProfile: User | null | undefined,
  joinedGroupIds: string[] = [],
  onIncidentsChange: (incidents: Incident[]) => void
): Unsubscribe => {
  if (!currentUser) {
    onIncidentsChange([]);
    return () => {};
  }

  const colRef = collection(db, 'incidents');
  const q = query(
    colRef,
    where('status', 'in', ['reported', 'verifying', 'active', 'monitoring']),
    orderBy('createdAt', 'desc'),
    limit(10)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const raw = snapshot.docs.map((d) => ({
        ...(d.data() as Incident),
        id: d.id,
      }));

      const filtered = raw.filter((inc) => isUserEligibleForIncident(inc, userProfile, joinedGroupIds));
      onIncidentsChange(filtered);
    },
    (err) => {
      console.error('Error subscribing to active incidents:', err);
      onIncidentsChange([]);
    }
  );
};

/**
 * User Action: Records explicit incident acknowledgement.
 */
export const acknowledgeIncident = async (incidentId: string, uid: string): Promise<void> => {
  if (!incidentId || !uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'incidentAcknowledgements', incidentId);
    await setDoc(docRef, { incidentId, acknowledgedAt: serverTimestamp() }, { merge: true });
    logAnalyticsEvent('campus_incident_acknowledged', { source: 'in_app' });
  } catch (err) {
    console.error(`Error acknowledging incident ${incidentId}:`, err);
  }
};

/**
 * User Action: Records explicit incident read state.
 */
export const recordIncidentRead = async (incidentId: string, uid: string): Promise<void> => {
  if (!incidentId || !uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'incidentReadState', incidentId);
    await setDoc(
      docRef,
      {
        incidentId,
        lastOpenedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`Error recording incident read for ${incidentId}:`, err);
  }
};
