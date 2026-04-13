

## Plan: Show Join button and follower count to all users

### Problem
The `JoinMissionButton` component currently renders `<AuthGate>` for logged-out users, which replaces the "Join" button with a "Join the network to contribute" link. The follower count is hidden from logged-out users.

### Changes

**`src/components/JoinMissionButton.tsx`**
- Remove the early return that renders `<AuthGate>` for unauthenticated users
- Always render the same button UI showing "Join" label and follower count
- For logged-out users: on click, navigate to `/signup` (consistent with `CreateMissionDialog` behavior)
- For logged-in users: existing toggle behavior (follow/unfollow) remains unchanged

This is a single-file change. All other features (mission card stats, mission page header button, user profile followed missions section) are already implemented and working.

### Files
- `src/components/JoinMissionButton.tsx` — restructure to always show button with count

