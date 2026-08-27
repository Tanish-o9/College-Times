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
  serverTimestamp 
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
