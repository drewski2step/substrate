

## Plan: Fix 8 issues in priority order

### 1. Block clicking fidelity (`BlockFlowChart.tsx`)
The `onClick` handler on line 190 checks `didDragRef.current`, but the issue is that `didDragRef` is initialized to `false` on grip mousedown (line 140) — however, the card's `onClick` fires even when no grip interaction happened, and `didDragRef` may retain `true` from a previous drag. Fix: reset `didDragRef` to `false` on every `mousedown` of the card itself (not just grip), and ensure `onClick` always fires when `didDragRef.current === false`. Also, the 3px threshold on line 147 is correct but `didDragRef` is never reset between clicks — add an `onMouseDown` on the card div that resets `didDragRef.current = false`.

### 2. Drag lag (`BlockFlowChart.tsx`)
Currently using `left`/`top` positioning during drag (lines 176-177, 182-186). Replace with CSS `transform: translate()` during drag for GPU acceleration. Keep `left`/`top` for resting position. During drag, set `left: posX, top: posY, transform: translate(dx, dy)` instead of computing `left: posX + dx`.

### 3. Discussion replies at mission level (`MissionFeed.tsx`)
Mission feed posts (lines 57-99) don't include the `ReplyThread` component or reply buttons. Add reply functionality by importing `ReplyThread` from `DiscussionPanel.tsx` (needs to be exported), and adding expand/reply UI to each mission feed post card, similar to `PostCard` in `DiscussionPanel.tsx`. Alternatively, refactor to use the `PostCard` component directly.

### 4. Un-completing blocks (`BlockView.tsx` + `BlockFlowChart.tsx`)
- In `BlockView.tsx` line 124: `canComplete` only allows pending/active. Add a "Reopen block" button when `status === "complete"` that sets status back to `"pending"`.
- In `BlockFlowChart.tsx` line 282-285: The "Done" button only shows for `canComplete`. Add a "Reopen" button when `status === "complete"`.

### 5. Password requirements (`SignUp.tsx`)
- Line 27: Change from `if (!/\d/.test(password))` to `if (!/[!@#$%^&*]/.test(password))`
- Update placeholder text to reflect new requirements
- Remove number requirement

### 6. Forgot password (new files + `Login.tsx`)
- Add `/forgot-password` route and page with email input calling `supabase.auth.resetPasswordForEmail`
- Add `/reset-password` route and page that handles the recovery token and calls `supabase.auth.updateUser`
- Add "Forgot password?" link to `Login.tsx`
- Update `App.tsx` with new routes

### 7. Rename Goals to Missions in UI
- `AppHeader.tsx` line 39: "Goals" → "Missions"
- `MissionView.tsx` line 61: "Goal not found" → "Mission not found"
- `MissionView.tsx` line 77: "This goal has been deleted" → "This mission has been deleted"
- `MissionView.tsx` line 83/121/133: "Goal updated/deleted/restored" → "Mission updated/deleted/restored"
- `MissionView.tsx` line 144: "Goals" → "Missions"
- `MissionView.tsx` line 199: "Delete this goal?" → "Delete this mission?"
- `MissionView.tsx` line 200: description text
- `CreateMissionDialog.tsx` line 36/50/55/58/105: "goal" → "mission" in all UI strings
- `MissionBoard.tsx` line 18: "Active coordination goals" → "Active coordination missions"

### 8. Files folder label (`BlockFlowChart.tsx`)
- Line 621: Change `filesBlockLabel` from `${parentBlockTitle} Files` to just `"Files"`

### Files to edit
- `src/components/BlockFlowChart.tsx` — issues 1, 2, 4, 8
- `src/components/MissionFeed.tsx` — issue 3
- `src/components/DiscussionPanel.tsx` — issue 3 (export ReplyThread)
- `src/pages/BlockView.tsx` — issue 4
- `src/pages/SignUp.tsx` — issue 5
- `src/pages/Login.tsx` — issue 6
- `src/pages/ForgotPassword.tsx` — new file, issue 6
- `src/pages/ResetPassword.tsx` — new file, issue 6
- `src/App.tsx` — issue 6
- `src/components/AppHeader.tsx` — issue 7
- `src/pages/MissionView.tsx` — issue 7
- `src/components/CreateMissionDialog.tsx` — issue 7
- `src/pages/MissionBoard.tsx` — issue 7

