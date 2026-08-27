import type { Timestamp, FieldValue } from 'firebase/firestore';

export type ListingStatus = 'active' | 'reserved' | 'sold' | 'expired' | 'hidden' | 'deleted';

export type MarketplaceCategory =
  | 'Electronics'
  | 'Books'
  | 'Notes'
  | 'Furniture'
  | 'Cycles'
  | 'Bikes'
  | 'Clothing'
  | 'Hostel Items'
  | 'Study Material'
  | 'Accessories'
  | 'Services'
  | 'Other';

export type ProductCondition = 'Brand New' | 'Like New' | 'Good' | 'Fair' | 'Poor';

export interface MarketplaceListing3 {
  id: string;
  title: string;
  description: string;
  price: number;
  category: MarketplaceCategory;
  condition: ProductCondition;
  images: string[];
  sellerId: string;
  sellerName: string;
  sellerUsername?: string;
  sellerAvatar?: string;
  locationArea?: string;
  negotiable: boolean;
  status: ListingStatus;
  reservedForUid?: string;
  viewCount: number;
  saveCount: number;
  interestCount?: number;
  createdAt: Timestamp | FieldValue | any;
  updatedAt?: Timestamp | FieldValue | any;
}

export type MarketplaceListing = MarketplaceListing3;

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';

export interface MarketplaceOffer {
  id: string;
  listingId: string;
  listingTitle?: string;
  buyerId: string;
  buyerName?: string;
  buyerAvatar?: string;
  sellerId: string;
  amount: number;
  status: OfferStatus;
  createdAt: Timestamp | FieldValue | any;
  updatedAt?: Timestamp | FieldValue | any;
}

export interface SellerReview {
  id: string;
  sellerUid: string;
  reviewerUid: string;
  reviewerName?: string;
  reviewerAvatar?: string;
  listingId: string;
  rating: number; // 1 to 5
  reviewText: string;
  createdAt: Timestamp | FieldValue | any;
}
