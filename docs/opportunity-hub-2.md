# Phase 49 — Campus Opportunity Hub 2.0 & Career Engagement

## Overview
Phase 49 introduces a production-grade Campus Opportunity Hub 2.0 experience:
- **Private Application Tracker** (`opportunityApplicationService.ts`, `MyApplications.tsx`): Applications tracked privately under `users/{uid}/opportunityApplications/{opportunityId}` (`saved`, `applied`, `assessment`, `interview`, `selected`, `rejected`, `withdrawn`).
- **Referral System** (`referralService.ts`): Applicants request referrals from alumni/students, triggering targeted single-recipient notifications.
- **Deterministic Ranking Engine** (`opportunityRankingService.ts`): Sorts opportunities based on recency, deadline proximity, referral availability, and skill matching.
- **Opportunity Discovery** (`OpportunityDiscovery.tsx`): Renders Recommended, Hackathons, Internships, and Full-Time Jobs.

---

## 1. Application Tracker Status Flow

| Status | Description | User Action | Privacy |
|---|---|---|---|
| `applied` | Application submitted | Update status, add notes | Private to User |
| `assessment` | Online test/challenge | Update status | Private to User |
| `interview` | Scheduled interview | Update status | Private to User |
| `selected` | Offer extended | Celebrate | Private to User |
| `rejected` | Application closed | Archive | Private to User |
