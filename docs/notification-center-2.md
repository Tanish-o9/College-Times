# Phase 50 — Smart Notification Center 2.0 & Priority Digests

## Overview
Phase 50 upgrades the Notification Center into a high-performance, prioritized system:
- **Unified Notification Taxonomy**: Categories include `social`, `groups`, `messages`, `events`, `opportunities`, `marketplace`, `feed`, `system`, `security`, and `emergency`.
- **Priority System**: Notifications carry a priority: `critical`, `high`, `normal`, or `low`.
- **Quiet Hours & Suppressions**: Users can define quiet hours (e.g. 10 PM to 7 AM) which suppress non-critical push notifications.
- **Hourly/Daily Digests**: Digests bundle non-urgent notifications to minimize delivery fatigue.
- **Actionable Alerts**: Supports in-app action buttons (accept join requests, RSVP, etc.) directly on notification cards.

---

## 1. Priority Taxonomy Rules

| Priority | Categories | Bypass Quiet Hours | Bypass Preferences |
|---|---|---|---|
| `critical` | `emergency` | Yes | Yes |
| `high` | `security`, `messages` (DMs), `deadline` | Yes | No |
| `normal` | `groups` (announcements), `events` | No | No |
| `low` | `social` (reactions, follows) | No | No |
