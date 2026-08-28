# Campus Feed 2.0

High-performance personalized campus feed with real-time alerts.

## Architectural Flow

1.  **Cursor-Based Querying**: Fetches posts in pages of 20 using Firestore query cursors (`startAfter(lastVisible)`).
2.  **Unseen Content Banner**: Realtime posts listener (limited to 5 items) detects incoming publications and prompts the user with an animated "New posts available" banner, preventing sudden layout reflow.
3.  **Idempotent Multi-Reactions**: Enforces deterministic keys (`postId_userId`) inside subcollection docs to prevent race-condition counter increments on repeated clicks.
4.  **Security Guards**: Enforces blocked-user exclusions, hidden posts indices, and private group visibility settings.
