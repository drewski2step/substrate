

## Plan: Global Discussions page with top-level navigation

### Summary
Create a network-wide discussions feed at `/discussions` showing all public discussion posts across every mission, with search, sort, filter, inline expansion with threaded replies, and realtime updates.

### 1. Add nav link — `src/components/AppHeader.tsx`
- Add a "Discussions" `<Link>` to the `<nav>` element alongside "Missions", pointing to `/discussions`
- Highlight when `location.pathname === "/discussions"` or starts with `/discussions`

### 2. Add route — `src/App.tsx`
- Import `Discussions` from `@/pages/Discussions`
- Add `<Route path="/discussions" element={<Discussions />} />`

### 3. Create page — `src/pages/Discussions.tsx` (new file)

**Data fetching** — a single `useQuery` that:
- Queries `discussions` table where `parent_id IS NULL`
- Joins `goals` (via `goal_id`) filtering `goals.visibility = 'public'`
- Joins `profiles` (via `user_id`) for username + avatar_seed
- Joins `blocks` (via `block_id`) for block title + goal_id
- Returns posts with attached mission title, block title, author info

Since Supabase JS client doesn't support cross-table joins without foreign keys, and this project uses `as any` casts throughout, the query will:
- Fetch top-level discussions with `parent_id IS NULL`
- Batch-fetch related goals, blocks, and profiles in parallel
- Merge client-side

**Page layout**:
- `AppHeader` at top
- Page title "Discussions" + subtitle
- Search input filtering by title/content
- Sort tabs: Top (relevance_score desc) / New (created_at desc)
- Filter dropdown: All Types / Question / Insight / Blocker / Resource / Proposal
- Post cards in a scrolling list

**Each post card** shows:
- Upvote button + count (requires auth; shows AuthGate for logged-out)
- TypeBadge (reuse from DiscussionPanel)
- Title + content preview (150 chars)
- Breadcrumb: Mission title → Block title (both as links)
- Author avatar + username (links to `/profile/:username`)
- Timestamp + reply count + resolved badge
- Click expands inline: full content, ReplyThread component, reply composer (auth-gated), mark resolved (author-only for questions)

**Realtime**: Subscribe to `postgres_changes` on `discussions` table, invalidate query on any change.

### 4. Auth gating
- Reading: fully public, no auth required
- Upvoting: wrap in auth check, show inline "Join the network" prompt
- Replying: ReplyThread already handles this via `useAuth` — logged-out users see the AuthGate prompt
- No redirects for logged-out users

### Files to edit
- `src/components/AppHeader.tsx` — add nav link
- `src/App.tsx` — add route
- `src/pages/Discussions.tsx` — new file

