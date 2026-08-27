export type MarketplaceCategory =
  | 'Books'
  | 'Notes'
  | 'Electronics'
  | 'Laptops'
  | 'Phones'
  | 'Accessories'
  | 'Furniture'
  | 'Cycles'
  | 'Sports Equipment'
  | 'Clothing'
  | 'Bags'
  | 'Study Material'
  | 'Hostel Items'
  | 'Instruments'
  | 'Other';

export type ProductCondition = 'new' | 'like_new' | 'good' | 'fair' | 'used';
export type ListingStatus = 'active' | 'reserved' | 'sold' | 'expired' | 'hidden' | 'deleted';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  category: MarketplaceCategory;
  price: number;
  currency: string;
  negotiable: boolean;
  condition: ProductCondition;
  images: string[];
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  status: ListingStatus;
  locationArea?: string;
  groupId?: string;
  eventId?: string;
  viewCount?: number;
  saveCount?: number;
  interestCount?: number;
  moderationStatus?: 'approved' | 'flagged' | 'hidden';
  createdAt: any;
  updatedAt?: any;
}

export interface MarketplaceOffer {
  id: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  buyerName: string;
  amount: number;
  message?: string;
  status: OfferStatus;
  createdAt: any;
  updatedAt?: any;
}

export interface MarketplaceInterest {
  userId: string;
  userName: string;
  createdAt: any;
}
