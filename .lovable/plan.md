

## Plan: Mission owner-only deletion, authenticated block deletion, and rate-limiting

### Summary
Three protection layers: (1) only mission owners can delete missions, (2) block deletion requires sign-in, and (3) new users who delete more than 5 blocks in quick succession are blocked from further deletions.

### 1. Mission deletion — owner only

**`src/pages/MissionView.tsx`**
- Change the condition that shows the delete button from `{user && ...}` to `{user && goal.created_by === user.id && ...}`
- The `handleDelete` function already checks `if (!user) return;` — add an additional check `if (goal.created_by !== user.id) return;`
- The edit button can remain visible to all logged-in users (or also restrict — will keep as-is per request scope)

### 2. Block deletion — require sign-in

**`src/pages/BlockView.tsx`**
- Wrap the delete block `AlertDialog` in a `{user && ...}` guard (it currently shows to everyone)

**`src/components/BlockFlowChart.tsx` (EditBlockDialog)**
- The `handleDelete` already checks `if (!user) return;`, and the dialog already requires `user` for save — add a UI guard to hide the Delete button when `!user`

### 3. Rate-limit: block new users from deleting >5 blocks quickly

**`src/hooks/use-blocks.ts` (`useDeleteBlock`)**
- Before executing a delete, query `edit_history` for recent block deletions by this user (e.g. last 10 minutes where `field_changed = 'deleted_at'` and `entity_type = 'block'`)
- Also check if the user account is "new" (created within the last 24 hours via `profile.created_at` or `user.created_at`)
- If the user is new AND has 5+ recent block deletions, throw an error and show a toast: "You've deleted too many blocks too quickly. Please slow down."
- This is a client-side guard. A database-level function could be added later for stronger enforcement.

**Alternative (stronger) approach for rate-limiting:**
- Create a database function `check_block_delete_rate(uuid)` that counts recent deletions and returns boolean
- Call it before delete — but this adds migration complexity

I'll use the client-side approach since it's simpler and covers the use case. The soft-delete pattern (setting `deleted_at`) already logs to `edit_history`, giving us the audit trail to count from.

### Files to modify
- `src/pages/MissionView.tsx` — owner-only delete button
- `src/pages/BlockView.tsx` — auth-gate the delete button  
- `src/components/BlockFlowChart.tsx` — auth-gate the delete button in edit dialog
- `src/hooks/use-blocks.ts` — add rate-limit check in `useDeleteBlock`

### No database changes needed
All protections use existing tables and client-side logic.

