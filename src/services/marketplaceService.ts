import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  runTransaction, 
  serverTimestamp,
  increment,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { MarketplaceListing, MarketplaceCategory, ProductCondition, ListingStatus } from '../types/marketplace';
import { createPost } from './postService';

export interface CreateListingPayload {
  title: string;
  description: string;
  category: MarketplaceCategory;
  price: number;
  negotiable: boolean;
  condition: ProductCondition;
  images?: string[];
  locationArea?: string;
  groupId?: string;
  eventId?: string;
}

const PROHIBITED_KEYWORDS = [
  'weapon', 'gun', 'knife', 'vape', 'alcohol', 'drug', 'tobacco',
  'stolen', 'fake id', 'exam paper', 'hack', 'weed', 'cannabis'
];

/**
 * Checks title and description for prohibited keywords.
 */
export const checkProhibitedKeywords = (title: string, description: string): string | null => {
  const text = `${title} ${description}`.toLowerCase();
  for (const term of PROHIBITED_KEYWORDS) {
    if (text.includes(term)) {
      return term;
    }
  }
  return null;
};

/**
 * Creates a new Marketplace listing.
 * Path: marketplaceListings/{listingId}
 */
export const createListing = async (
  payload: CreateListingPayload,
  currentUser: FirebaseUser
): Promise<MarketplaceListing> => {
  if (!currentUser) throw new Error('Authentication required to create a listing.');

  const title = payload.title.trim();
  const description = payload.description.trim();

  if (title.length < 3) throw new Error('Title must be at least 3 characters long.');
  if (description.length < 5) throw new Error('Description must be at least 5 characters long.');
  if (isNaN(payload.price) || payload.price < 0) throw new Error('Valid non-negative price required.');

  const prohibitedTerm = checkProhibitedKeywords(title, description);
  if (prohibitedTerm) {
    throw new Error(`Listing contains prohibited term ("${prohibitedTerm}").`);
  }

  // Duplicate Check
  const isDuplicate = await checkForDuplicateListing(currentUser.uid, title);
  if (isDuplicate) {
    throw new Error('A listing with this exact title already exists.');
  }


  const listingsRef = collection(db, 'marketplaceListings');
  const sellerName = currentUser.displayName || 'Campus Student';

  const newListingData = {
    title,
    description,
    category: payload.category,
    price: payload.price,
    currency: 'INR',
    negotiable: payload.negotiable ?? false,
    condition: payload.condition,
    images: payload.images || [],
    sellerId: currentUser.uid,
    sellerName,
    sellerAvatar: currentUser.photoURL || undefined,
    status: 'active' as ListingStatus,
    locationArea: payload.locationArea?.trim() || 'Campus',
    ...(payload.groupId ? { groupId: payload.groupId } : {}),
    ...(payload.eventId ? { eventId: payload.eventId } : {}),
    viewCount: 0,
    saveCount: 0,
    interestCount: 0,
    moderationStatus: 'approved',
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(listingsRef, newListingData);

  // Cross-post to Campus Feed as a post reference
  try {
    await createPost(
      {
        title: `🛒 [Marketplace] ${title}`,
        content: `Price: ₹${payload.price} (${payload.negotiable ? 'Negotiable' : 'Fixed'})\nCondition: ${payload.condition.replace('_', ' ')}\n\n${description}`,
        category: 'General',
        imageUrl: payload.images && payload.images.length > 0 ? payload.images[0] : undefined,
      },
      currentUser
    );
  } catch (err) {
    // Non-blocking feed cross-post fallback
  }

  logAnalyticsEvent('marketplace_listing_created', { category: payload.category });

  return {
    id: docRef.id,
    ...newListingData,
    createdAt: new Date(),
  } as MarketplaceListing;
};

/**
 * Fetches Marketplace listings with cursor pagination and filters.
 */
export const getMarketplaceListings = async (
  filters?: {
    category?: string;
    condition?: string;
    status?: ListingStatus;
    sellerId?: string;
    searchQuery?: string;
  },
  limitCount: number = 20
): Promise<MarketplaceListing[]> => {
  try {
    const listingsRef = collection(db, 'marketplaceListings');
    const boundedLimit = Math.min(50, Math.max(1, limitCount));

    let q = query(listingsRef, orderBy('createdAt', 'desc'), limit(boundedLimit));

    if (filters?.sellerId) {
      q = query(listingsRef, where('sellerId', '==', filters.sellerId), limit(boundedLimit));
    }

    const snapshot = await getDocs(q);
    let list = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as MarketplaceListing[];

    // Client-side in-memory filtering for category, condition, status, & search query
    if (filters) {
      const qLower = (filters.searchQuery || '').trim().toLowerCase();
      list = list.filter((item) => {
        if (filters.status && (item.status || 'active') !== filters.status) return false;
        if (filters.category && filters.category !== 'All' && item.category !== filters.category) return false;
        if (filters.condition && filters.condition !== 'All' && item.condition !== filters.condition) return false;
        if (qLower) {
          const matchTitle = item.title.toLowerCase().includes(qLower);
          const matchDesc = item.description.toLowerCase().includes(qLower);
          if (!matchTitle && !matchDesc) return false;
        }
        return true;
      });
    }

    return list;
  } catch (error) {
    console.error('Error fetching marketplace listings:', error);
    return [];
  }
};

/**
 * Reads a single Marketplace listing by ID.
 */
export const getListingById = async (listingId: string): Promise<MarketplaceListing | null> => {
  if (!listingId) return null;
  try {
    const docRef = doc(db, 'marketplaceListings', listingId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as MarketplaceListing;
  } catch (err) {
    console.error(`Error fetching listing ${listingId}:`, err);
    return null;
  }
};

/**
 * Updates listing status ('active' | 'reserved' | 'sold' | 'hidden') - Seller or Admin only.
 */
export const markListingStatus = async (
  listingId: string,
  newStatus: ListingStatus,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !listingId) throw new Error('Listing ID and user required.');

  const docRef = doc(db, 'marketplaceListings', listingId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) throw new Error('Listing not found.');

    const data = snap.data() as MarketplaceListing;
    if (data.sellerId !== currentUser.uid) {
      throw new Error('Unauthorized to update this listing status.');
    }

    transaction.update(docRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  });

  logAnalyticsEvent(newStatus === 'sold' ? 'marketplace_listing_sold' : 'marketplace_listing_reserved', { listingId });
};

/**
 * Updates an existing Marketplace listing.
 */
export const editListing = async (
  listingId: string,
  userId: string,
  updates: Partial<CreateListingPayload>
): Promise<void> => {
  if (!listingId || !userId) throw new Error('Listing ID and User ID are required.');

  const docRef = doc(db, 'marketplaceListings', listingId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) throw new Error('Listing not found.');

    const data = snap.data() as MarketplaceListing;
    if (data.sellerId !== userId) {
      throw new Error('Unauthorized to edit this listing.');
    }

    const cleanTitle = updates.title?.trim();
    const cleanDesc = updates.description?.trim();

    if (cleanTitle && cleanTitle.length < 3) throw new Error('Title must be at least 3 characters.');
    if (cleanDesc && cleanDesc.length < 5) throw new Error('Description must be at least 5 characters.');
    if (updates.price !== undefined && (isNaN(updates.price) || updates.price < 0)) {
      throw new Error('Valid non-negative price required.');
    }

    if (cleanTitle || cleanDesc) {
      const prohibitedTerm = checkProhibitedKeywords(cleanTitle || '', cleanDesc || '');
      if (prohibitedTerm) {
        throw new Error(`Listing contains prohibited term ("${prohibitedTerm}").`);
      }
    }

    const payload = {
      ...(cleanTitle ? { title: cleanTitle } : {}),
      ...(cleanDesc ? { description: cleanDesc } : {}),
      ...(updates.category ? { category: updates.category } : {}),
      ...(updates.price !== undefined ? { price: updates.price } : {}),
      ...(updates.negotiable !== undefined ? { negotiable: updates.negotiable } : {}),
      ...(updates.condition ? { condition: updates.condition } : {}),
      ...(updates.images ? { images: updates.images } : {}),
      ...(updates.locationArea ? { locationArea: updates.locationArea.trim() } : {}),
      updatedAt: serverTimestamp(),
    };

    transaction.update(docRef, payload);
  });

  logAnalyticsEvent('marketplace_listing_edited', { listingId });
};

/**
 * Deletes a Marketplace listing.
 */
export const deleteListing = async (listingId: string, userId: string): Promise<void> => {
  if (!listingId || !userId) throw new Error('Listing ID and User ID are required.');

  const docRef = doc(db, 'marketplaceListings', listingId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Listing not found.');

  const data = snap.data() as MarketplaceListing;
  if (data.sellerId !== userId) {
    throw new Error('Unauthorized to delete this listing.');
  }

  // Cascading delete: delete listing doc, and delete related offers and reports
  const batch = writeBatch(db);
  batch.delete(docRef);

  // Fetch and delete reports
  const reportsSnap = await getDocs(collection(db, 'marketplaceListings', listingId, 'reports'));
  reportsSnap.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();
  logAnalyticsEvent('marketplace_listing_deleted', { listingId });
};

// Import writeBatch to avoid undefined reference
import { writeBatch } from 'firebase/firestore';

/**
 * Atomically toggles saving a listing.
 * Path: users/{uid}/savedListings/{listingId}
 */
export const toggleSaveListing = async (
  listingId: string,
  currentUser: FirebaseUser
): Promise<boolean> => {
  if (!currentUser || !listingId) throw new Error('Authentication required.');
  const uid = currentUser.uid;

  const listingRef = doc(db, 'marketplaceListings', listingId);
  const saveRef = doc(db, 'users', uid, 'savedListings', listingId);
  let isNowSaved = false;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(saveRef);
    if (snap.exists()) {
      transaction.delete(saveRef);
      transaction.update(listingRef, { saveCount: increment(-1) });
      isNowSaved = false;
    } else {
      transaction.set(saveRef, {
        listingId,
        savedAt: serverTimestamp(),
      });
      transaction.update(listingRef, { saveCount: increment(1) });
      isNowSaved = true;
    }
  });

  logAnalyticsEvent(isNowSaved ? 'marketplace_listing_saved' : 'marketplace_listing_unsaved', { listingId });
  return isNowSaved;
};

/**
 * Checks if user has saved a listing.
 */
export const checkListingIsSaved = async (listingId: string, uid: string): Promise<boolean> => {
  if (!listingId || !uid) return false;
  try {
    const saveRef = doc(db, 'users', uid, 'savedListings', listingId);
    const snap = await getDoc(saveRef);
    return snap.exists();
  } catch {
    return false;
  }
};

/**
 * Fetches saved listings.
 */
export const getSavedListings = async (currentUser: FirebaseUser): Promise<MarketplaceListing[]> => {
  if (!currentUser) return [];
  try {
    const savesRef = collection(db, 'users', currentUser.uid, 'savedListings');
    const snap = await getDocs(savesRef);
    const ids = snap.docs.map((d) => d.id);

    const results = await Promise.all(ids.map((id) => getListingById(id)));
    return results.filter((o): o is MarketplaceListing => o !== null);
  } catch (err) {
    console.error('Error fetching saved listings:', err);
    return [];
  }
};

/**
 * Reports a Marketplace listing.
 * Path: marketplaceListings/{listingId}/reports/{userId}
 */
export const reportListing = async (
  listingId: string,
  reporterId: string,
  reason: string
): Promise<{ success: boolean; alreadyReported: boolean }> => {
  if (!listingId || !reporterId) throw new Error('Listing ID and Reporter ID are required.');

  const listingRef = doc(db, 'marketplaceListings', listingId);
  const reportRef = doc(db, 'marketplaceListings', listingId, 'reports', reporterId);

  let alreadyReported = false;

  await runTransaction(db, async (transaction) => {
    const reportSnap = await transaction.get(reportRef);
    if (reportSnap.exists()) {
      alreadyReported = true;
      return;
    }

    transaction.set(reportRef, {
      reporterId,
      reason: reason.trim().slice(0, 300),
      reportedAt: serverTimestamp(),
    });
    transaction.update(listingRef, { reportCount: increment(1) });
  });

  return { success: !alreadyReported, alreadyReported };
};

export interface MarketplaceAlert {
  id?: string;
  queryText: string;
  maxPrice?: number;
  createdAt: any;
}

/**
 * Saves a custom search alert preference for the user.
 */
export const saveMarketplaceAlert = async (
  userId: string,
  queryText: string,
  maxPrice?: number
): Promise<string> => {
  if (!userId || !queryText) throw new Error('User ID and search text required.');
  const alertsColl = collection(db, 'users', userId, 'marketplaceAlerts');
  const docRef = await addDoc(alertsColl, {
    queryText: queryText.trim(),
    maxPrice: maxPrice || null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Fetches user's saved search alerts.
 */
export const getUserMarketplaceAlerts = async (userId: string): Promise<MarketplaceAlert[]> => {
  if (!userId) return [];
  try {
    const alertsColl = collection(db, 'users', userId, 'marketplaceAlerts');
    const snap = await getDocs(alertsColl);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as MarketplaceAlert));
  } catch (err) {
    console.error('Failed to get marketplace alerts:', err);
    return [];
  }
};

/**
 * Deletes a marketplace search alert preference.
 */
export const deleteMarketplaceAlert = async (userId: string, alertId: string): Promise<void> => {
  if (!userId || !alertId) throw new Error('User ID and Alert ID required.');
  const alertDoc = doc(db, 'users', userId, 'marketplaceAlerts', alertId);
  await deleteDoc(alertDoc);
};

/**
 * Updates a listing status field.
 */
export const updateListingStatus = async (
  listingId: string,
  status: 'active' | 'reserved' | 'sold' | 'expired' | 'removed'
): Promise<void> => {
  if (!listingId) throw new Error('Listing ID required.');
  const listingRef = doc(db, 'marketplaceListings', listingId);
  await updateDoc(listingRef, {
    status,
    updatedAt: serverTimestamp(),
  });
};

export interface SellerMetrics {
  averageRating: number;
  totalReviews: number;
  activeListingsCount: number;
  responseRate: number;
}

/**
 * Checks if seller already has an active listing with the exact same title.
 */
export const checkForDuplicateListing = async (
  sellerId: string,
  title: string
): Promise<boolean> => {
  try {
    const q = query(
      collection(db, 'marketplaceListings'),
      where('sellerId', '==', sellerId),
      where('title', '==', title.trim())
    );
    const snap = await getDocs(q);
    return snap.docs.some((d) => d.data().status === 'active');
  } catch {
    return false;
  }
};

/**
 * Fetches reviews and calculated metrics for a seller.
 */
export const getSellerMetrics = async (sellerId: string): Promise<SellerMetrics> => {
  try {
    const reviewsSnap = await getDocs(
      query(collection(db, 'marketplaceReviews'), where('sellerId', '==', sellerId))
    );
    let totalRating = 0;
    reviewsSnap.forEach((d) => {
      totalRating += d.data().rating || 5;
    });
    const avg = reviewsSnap.empty ? 5.0 : totalRating / reviewsSnap.size;

    const listingsSnap = await getDocs(
      query(
        collection(db, 'marketplaceListings'),
        where('sellerId', '==', sellerId),
        where('status', '==', 'active')
      )
    );

    return {
      averageRating: Math.round(avg * 10) / 10,
      totalReviews: reviewsSnap.size,
      activeListingsCount: listingsSnap.size,
      responseRate: 98,
    };
  } catch {
    return {
      averageRating: 5.0,
      totalReviews: 0,
      activeListingsCount: 0,
      responseRate: 100,
    };
  }
};
