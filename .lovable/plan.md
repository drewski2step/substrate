

## Plan: Fix blocks not saving creator info

### Root cause
The `useCreateBlock` hook inserts blocks without setting `created_by`. Every block in the database has `created_by = null`, so the avatar/username display code works but has no data to show.

### Changes

**`src/hooks/use-blocks.ts`**
- Update `useCreateBlock` to accept the current user's ID and include `created_by: userId` in the insert payload
- The mutation function signature changes to accept `created_by?: string`

**`src/components/BlockFlowChart.tsx`**
- Where `createBlock.mutate(...)` is called, pass `created_by: user?.id` so new blocks are attributed to the logged-in user

**`src/pages/MissionView.tsx`** (if blocks are created here too)
- Same fix: pass `created_by` when creating blocks

### Backfill existing blocks (optional)
- Run a one-time SQL update to set `created_by` on existing blocks where possible (e.g. from `edit_history` records), or leave them as anonymous

### No database schema changes needed
The `created_by` column already exists on the `blocks` table.

