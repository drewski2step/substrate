

## Plan: Show creator profiles on missions and blocks

### What changes
Display the username (linked to their profile) of the person who created each mission and block, visible to all users.

### 1. Mission page — show creator under title
**`src/pages/MissionView.tsx`**
- Add a query to fetch the creator's profile using `goal.created_by` from the `profiles` table
- Below the mission title/description area, render "Created by [username]" with a link to `/profile/[username]`

### 2. Block cards in flow chart — show creator
**`src/components/BlockFlowChart.tsx`**
- The `blocks` table has `created_by` but the flow chart doesn't display it
- Batch-fetch profiles for all unique `created_by` IDs in the current block set
- Show the creator username on each block card (small text below the title)

### 3. Block detail page — show creator
**`src/pages/BlockView.tsx`**
- Fetch the profile for `block.created_by`
- Display "Created by [username]" near the block title, linked to their profile

### Files to modify
- `src/pages/MissionView.tsx` — add creator profile fetch and display
- `src/components/BlockFlowChart.tsx` — batch fetch creator profiles, show on cards
- `src/pages/BlockView.tsx` — add creator profile fetch and display

### No database changes needed
The `profiles` table is publicly readable and `created_by` already exists on both `goals` and `blocks`.

