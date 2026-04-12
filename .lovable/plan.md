

## Plan: Implement user profile page at `/profile/:username`

### Summary
Create a new `UserProfile` page that displays a user's avatar, username, join date, pledged blocks, stats, and an edit option for the logged-in user's own profile. Add the route to `App.tsx`.

### New file: `src/pages/UserProfile.tsx`

**Layout** (follows existing page patterns — `AppHeader`, `max-w-5xl` container, `animate-fade-in-up`):

1. **Data fetching**: Use `useParams` to get `username`, then query `profiles` table by username. If no profile found, render a "User not found" message (not NotFound/404).

2. **Header section**: Robot avatar (DiceBear via `getAvatarUrl`), username as h1, join date formatted with `date-fns` or `toLocaleDateString`.

3. **Stats row**: Three counts in a horizontal row:
   - Missions created: `SELECT count(*) FROM goals WHERE created_by = profileId`
   - Blocks created: `SELECT count(*) FROM blocks WHERE created_by = profileId`
   - Discussion posts: `SELECT count(*) FROM discussions WHERE user_id = profileId`
   - Fetched via three separate `useQuery` calls or a single combined query.

4. **Pledged blocks section**: Query `block_pledges` where `user_id = profileId AND active = true`, join with `blocks` for title/goal_id. Each renders as a card linking to `/mission/{goal_id}/block/{block_id}`.

5. **Edit profile** (own profile only): If `authUser.id === profile.id`, show an "Edit profile" button that opens a dialog with:
   - Username input (with uniqueness check on save)
   - Display-only email (from `user.email`)
   - Save calls `supabase.from("profiles").update({ username }).eq("id", userId)` and refreshes the auth context profile.

### Changes to `src/App.tsx`
- Import `UserProfile` and add route: `<Route path="/profile/:username" element={<UserProfile />} />`

### Files
- `src/pages/UserProfile.tsx` — new
- `src/App.tsx` — add route

