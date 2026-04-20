

## Plan: Completed blocks collapse into Utah-colored bricks at the bottom of the canvas

### 1. Database schema additions

Add three nullable columns to `blocks`:
- `brick_color` (text) — assigned hex color from the Utah palette at completion
- `completed_by` (uuid) — the user who marked it complete
- `completed_at` (timestamptz) — when it was completed

Migration: simple `ALTER TABLE blocks ADD COLUMN ...` for each. No backfill needed; existing complete blocks just won't have a color until they're reopened and re-completed (or we can backfill them with random colors as a one-shot — see optional below).

**Optional**: Backfill `brick_color` for already-complete blocks with random Utah colors so they appear immediately.

### 2. Completion logic update

**`src/hooks/use-blocks.ts`** — extend `useUpdateBlock` updates type to include the new columns. Add a small helper `pickUtahColor()` that returns a random hex from the palette.

**`src/components/BlockFlowChart.tsx`** + **`src/pages/BlockView.tsx`** — every place that toggles status:
- Going `pending/active → complete`: also set `brick_color: pickUtahColor()`, `completed_by: user.id`, `completed_at: now()`
- Going `complete → pending` (reopen): also set `brick_color: null`, `completed_by: null`, `completed_at: null`

The Files Block (`is_files_block = true`) is already excluded from the completion flow — keep that invariant; never assign a brick color to it.

### 3. Split rendering: active canvas vs. brick strip

In `BlockFlowChart.tsx`, partition `blocks` into:
- `activeBlocks`: status ≠ complete (rendered as today on the absolute-positioned canvas)
- `completedBricks`: status === complete and not a files block (rendered in the new strip)

The active canvas keeps all current behavior — positions, connectors, dragging, sizing — exactly as-is for non-completed blocks. Connectors that previously drew toward a completed block stop at its parent (we'll filter completed blocks out of the connector inputs so no arrows dangle).

### 4. Brick strip component

New sub-component `BrickStrip` rendered **below** the canvas container (not inside it):
- Separator: a 1px dashed top border in `border-muted-foreground/20` to match the canvas border style, with 16px of vertical padding above the label
- Label: `COMPLETED (n)` in muted uppercase mono — matches the existing "Block flow" header style for visual cohesion
- Bricks: flex-wrap row, 4px gap, sorted by `completed_at` ascending (oldest left, newest right). Wrapping naturally stacks new rows on top via `flex-wrap` with `flex-direction: row` — the visual "sediment stacking upward" comes from sorting + wrap order
- Height: auto, grows with content

Each `Brick` is a 120×36, 6px-radius button with `background: brick_color`. White (`#E8E4D9`) bricks get a 1px border in `#B4B2A9`. No text, no icons.

### 5. Hover tooltip on bricks

Use the existing Radix `Tooltip` primitive (`@/components/ui/tooltip`) for accessibility and auto-flip behavior (handles "never overflow off screen"):
- Positioned above the brick (`side="top"`)
- Custom dark styling: `bg-[#1a1a1a] text-white px-2 py-2 rounded-md text-[13px]`
- Content: bold title line, `Completed by [username]`, formatted date/time
- Username comes from the same `creatorMap` pattern already used (extend it to also fetch profiles for `completed_by` IDs)

### 6. Completion animation

When `onComplete` is fired and the new status is `complete`:
- Set local UI state `animatingOutId = block.id`
- The active `BlockCard` for that id renders with class `animate-[scale-out_400ms_ease-in_forwards]` (existing `scale-out` keyframe in tailwind config)
- After 400ms, clear the local state. By that point the realtime/query invalidation has updated `blocks` and the brick appears in the strip
- The new brick fades in via `animate-fade-in` (existing keyframe, ~300ms — close enough to the requested 200ms; we'll tune via inline style if needed)

### 7. Un-completing a brick

Click a brick → opens a small Radix `Popover` anchored to it with text `Reopen this block?` and a `Confirm` button. Confirm fires the same `updateBlock.mutate` clearing status + brick_color + completed_by + completed_at. The brick disappears from the strip and the card reappears in the active canvas with `animate-fade-in`. The card's last saved `position_x/position_y` is preserved so it returns to its previous spot.

### 8. Realtime

The existing `useRealtimeSync(missionId)` hook already subscribes to `blocks` changes and invalidates the `["blocks", goalId]` query. No new realtime wiring needed — when any user completes/reopens a block, all viewers' query refreshes and the partition recomputes, animating the transition.

### 9. Files preserved

- Files Block remains pinned at the top (current behavior unchanged)
- It is excluded from `completedBricks` regardless of status
- All existing block functionality — drag, resize, edit, delete, dependencies, deadlines, recurrence, pledges, heat — stays untouched

### Files to modify

- New migration: add `brick_color`, `completed_by`, `completed_at` columns to `blocks`
- `src/hooks/use-blocks.ts` — type additions, `pickUtahColor()` helper, optional small `useReopenBlock` convenience that bundles the field clearing
- `src/components/BlockFlowChart.tsx` — partition blocks, render `BrickStrip` below canvas, completion animation state, update `onComplete` to set color/by/at, extend `creatorMap` to include completers
- `src/pages/BlockView.tsx` — update the "Mark complete" / "Reopen block" buttons to set/clear the same three fields
- `src/integrations/supabase/types.ts` — auto-regenerated after migration

### Visual reference

```text
┌──────────────────── Active canvas ────────────────────┐
│  [Files Block]                                         │
│                                                        │
│   ┌──────┐    ┌──────┐                                 │
│   │block │───►│block │                                 │
│   └──────┘    └──────┘                                 │
│                                                        │
└────────────────────────────────────────────────────────┘
- - - - - - - - - - - - - - - - - - - - - - - - - - - -
COMPLETED (7)
[██][██][██][██]   ← newer row (top)
[██][██][██]       ← older row (bottom)
```

