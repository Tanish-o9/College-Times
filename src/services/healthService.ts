import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';

/**
 * Health check service to confirm Firestore database connectivity.
 * Note: Database region is asia-south1 (Mumbai).
 */
export const checkFirestoreHealth = async (): Promise<boolean> => {
  try {
    const q = query(collection(db, '_healthcheck'), limit(1));
    await getDocs(q);
    console.log('Firestore connection successfully verified.');
    toast.success('Firestore connected (asia-south1)', { id: 'firestore-health' });
    return true;
  } catch (error: any) {
    console.error('Firestore health check failed:', error);
    toast.error(`Firestore connect note: ${error.message || 'Check config in .env'}`, { id: 'firestore-health' });
    return false;
  }
};
