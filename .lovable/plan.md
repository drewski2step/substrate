

## Plan: Fix visibility update RLS error + move toggle to edit form

### Root cause

The goal `e7a39a73-d302-4a05-8bd2-4b5397c00701` has `created_by: NULL` and zero rows in `flow_members`. When you update its visibility to "private", the UPDATE succeeds but the row immediately becomes unreadable by the SELECT policy (`visibility='public' OR is_flow_member(...)`). The Supabase client interprets this as an RLS violation.

The UPDATE policy also lacks an explicit `WITH CHECK` clause, which can cause issues in some edge cases.

### Changes

**1. Database migration**
- Drop and recreate the UPDATE policy on `goals` with explicit `WITH CHECK (true)` to guarantee updates always pass
- Backfill: for any goals with `created_by IS NOT NULL` that are missing from `flow_members`, insert an owner row (same as the earlier backfill but catching any new gaps)
- For goals with `created_by IS NULL`, set `created_by` to the current user's auth.uid if there's a known owner, or leave as-is

**2. Move visibility toggle into the edit form** (`MissionView.tsx`)
- In the editing state (lines 143-151), add a Public/Private toggle below the description textarea — two buttons styled like the creation dialog, showing the current selection
- Add `editVisibility` state initialized from `goal.visibility` when editing starts
- Include visibility changes in `saveEdit()` — if changed, log edit history and include in the update mutation
- Remove the clickable badge logic from the non-editing header (lines 156-195) — replace with a static read-only badge (globe/lock icon + text) that is not interactive
- Keep the static badge for logged-out users as-is

**3. Files to edit**
- New SQL migration (RLS fix + backfill)
- `src/pages/MissionView.tsx` (move toggle to edit form, simplify header badge)

