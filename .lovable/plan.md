
What I found

- The `goals` INSERT policy is already correct in the live database: authenticated users can insert with `WITH CHECK (true)`.
- The real issue is the owner-membership automation: `public.auto_add_goal_owner()` exists, but the `on_goal_created_add_owner` trigger does not currently exist in the database.
- The current create flow uses `.insert(...).select().single()`. Public missions work because the new row is immediately readable. Private missions fail because, without the owner-membership trigger, the new private row is not readable right after insert, so the UI surfaces the RLS error.
- The creation UI is already passing `visibility`, and the mutation is already sending `created_by`. So the form itself is not the missing piece.

Implementation plan

1. Restore the missing goal-owner trigger
- Add a migration that recreates `on_goal_created_add_owner` on `public.goals`
- Keep it `AFTER INSERT` and have it call `public.auto_add_goal_owner()`
- Make it idempotent with `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`
- Add a small backfill in the same migration to insert missing `owner` memberships for any existing goals that already have `created_by`

2. Harden mission creation in the client
- Update `useCreateGoal()` so it requires an authenticated user id and no longer falls back to `created_by: null`
- Generate the mission id client-side before insert
- Insert the row without depending on `.select().single()` for the response
- Return the generated id locally and navigate using that id

3. Validate the fix end-to-end
- Create a private mission while signed in
- Confirm the new row is in `goals` with `visibility = 'private'`
- Confirm a matching `flow_members` row is created with role `owner`
- Confirm the creator lands on and can view the mission immediately
- Confirm a logged-out user gets “not found” for the private mission URL
- Re-test public mission creation to ensure nothing regressed

Technical details

- I do not plan to loosen the INSERT policy further, because the live policy is already permissive for authenticated users.
- The bug is caused by a missing database trigger plus a fragile post-insert read of a private row.
- This fix preserves existing public mission behavior while making private mission creation reliable.
