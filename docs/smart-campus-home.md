# Phase 47 — Smart Campus Home Dashboard & Overview

## Overview
Phase 47 introduces a production-grade Smart Campus Home Dashboard (`CampusHome.tsx`, `/`):
- **Fixed Emergency Alert Priority**: Active campus emergency alerts automatically anchor at index 0, overriding all personalization or user ranking settings.
- **Personalized Section Ranking** (`homeRankingService.ts`): Deterministic section ranking combining recency, unread notifications, upcoming events, and group activity.
- **Customizable Dashboard Layout** (`HomePreferencesModal.tsx`): Allows users to reorder and toggle widget visibility stored under `users/{uid}/homePreferences/settings`.
- **Quick Action Launcher**: Quick routes for `Create Post`, `Create Group`, `Create Event`, `Create Poll`, `Group Instant`, and `Search Campus`.
- **Independent Widget Error Boundaries**: Prevents single-widget failures from crashing the entire dashboard.

---

## 1. Widget Inventory & Priorities

| Widget ID | Name | Default Priority | Override Rule |
|---|---|---|---|
| `emergencyAlerts` | Emergency Alerts | `1000` | Fixed Top Position (Cannot be disabled or moved) |
| `quickActions` | Quick Actions | `900` | Configurable |
| `upcomingEvents` | Upcoming Events | `800` | Configurable |
| `groupActivity` | Group Activity | `750` | Configurable |
| `trendingPosts` | Trending Campus Posts | `700` | Configurable |
| `moments` | Group Instants | `650` | Configurable |
| `activePolls` | Active Polls | `600` | Configurable |
| `followingActivity` | Following Activity | `550` | Configurable |
| `peopleSuggestions` | People You May Know | `500` | Configurable |
| `recentNotifications` | Recent Notifications | `450` | Configurable |
| `continueConversations` | Continue Conversations | `400` | Configurable |
