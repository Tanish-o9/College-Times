# Phase 48 — Campus Marketplace 3.0, Offers & Seller Trust

## Overview
Phase 48 introduces a production-grade Campus Marketplace 3.0 experience:
- **Listing Lifecycle Management**: Listings support status states (`active`, `reserved`, `sold`, `expired`, `hidden`).
- **Chat-to-Buy Integration**: Seamlessly pre-fills item metadata into private direct messaging (`directMessageService.ts`).
- **Transaction-Safe Offer System** (`marketplaceOfferService.ts`): Buyer submits price offer, seller accepts/rejects, buyer withdraws with targeted single-recipient notifications.
- **Seller Reputation & Verified Reviews** (`marketplaceReviewService.ts`): Buyers leave 1–5 star reviews with optional 500-char feedback updating seller rating transactionally.
- **Storage Rules**: Hardened upload rules at `marketplaceMedia/{listingId}/{userId}/{filename}`.

---

## 1. Listing Lifecycle States

| Status | Seller Action | Buyer Action | Visibility |
|---|---|---|---|
| `active` | Edit, Reserve, Mark Sold | Chat-to-Buy, Make Offer | Public |
| `reserved` | Release, Mark Sold | View Only | Public |
| `sold` | Archived | View Only | Public |
| `expired` | Relist | Hidden | Hidden |
