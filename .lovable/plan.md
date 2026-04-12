

## Plan: Unify BlockView layout to match MissionView

### Goal
Make every block level look identical to the mission level: a full-width view with two tabs at the top — "Block Flow" and "Discussions" — instead of the current side-by-side split with a right panel.

### Changes

**1. Rewrite BlockView layout** (`src/pages/BlockView.tsx`)
- Remove the `grid grid-cols-1 lg:grid-cols-5` two-panel layout
- Replace with the same `Tabs` pattern from MissionView:
  - Tab 1: "Block Flow" — full-width `BlockFlowChart` (same props as now)
  - Tab 2: "Discussions" — full-width `DiscussionPanel` (same props as now, using the existing reddit-style component unchanged)
- Remove the "Chat" tab entirely (the `BlockChatPanel` import and usage)
- Keep everything else: breadcrumb, title row, status badge, heat, actions (mark complete, pledge, delete), realtime indicator
- Change `max-w-7xl` to `max-w-5xl` to match MissionView

**2. No changes to DiscussionPanel or MissionFeed**
- The reddit-style discussion component stays exactly as-is
- MissionView stays exactly as-is

### Files to edit
- `src/pages/BlockView.tsx` — layout refactor only

### What stays the same
- Breadcrumb navigation
- Block title, status badge, heat indicator
- Action buttons (mark complete, pledge, delete)
- DiscussionPanel component and its styling
- BlockFlowChart component

