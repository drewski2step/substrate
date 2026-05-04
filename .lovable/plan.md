# Move Block Modal — UX Refinements

Update `src/components/MoveBlockModal.tsx` with three changes. Props, Supabase logic, and external imports stay identical.

## 1. Exclude completed blocks from destinations

Extend the `visibleChildren` filter to also exclude blocks with `status === 'complete'`:

```ts
blocks.filter(b =>
  b.parent_block_id === currentFolderId &&
  !(b as any).is_files_block &&
  b.status !== 'complete'
)
```

Note: completed blocks are still considered when computing `descendantIds` (so we don't accidentally allow moving a block under its own completed descendant), but they will never appear as a row.

## 2. Split each row into two interaction zones

Replace the current single-row layout with a two-zone row:

```text
┌─────────────────────────────────┬──────┐
│  Block title (click = MOVE)     │  >   │  ← click = drill in
└─────────────────────────────────┴──────┘
```

Per-row behavior:
- **Left zone** (flex-1): button element. Click → call `handleMoveTo(b.id)` which runs the existing Supabase update with `parent_block_id = b.id` and closes via `onMoved()`. Hover highlights left zone only (`hover:bg-muted/60`).
- **Right zone** (~44px, `w-11`): button element with `ChevronRight`. Click → `setPath([...path, b])`. Hover highlights right zone only. Rendered **only if the block has children** (any non-files, non-completed child? — we'll use "has any child block at all" so the user can still drill into folders that only contain completed items… actually per spec "only if it has children"; we'll define children as any block with `parent_block_id === b.id`, since completed-only folders would show empty inside — we'll match the visible filter so we don't show a chevron leading to an empty list).
  - Decision: a row gets a chevron iff `visibleChildren-style filter` returns ≥1 child for that block (i.e. at least one non-files, non-completed direct child).
- **Vertical divider**: a `w-px bg-border` element between the two zones, only rendered when the chevron zone exists.
- **Disabled rows** (block being moved or its descendants): single full-width `div`, `opacity-40 cursor-not-allowed`, no divider, no chevron, not clickable.
- **Current parent indicator**: keep the `(current parent)` muted hint; the left zone is still clickable (moving to current parent is a no-op but harmless — we can also short-circuit if `b.id === currentParentId` to skip the network call and just close).

Refactor the existing `handleMove` into:
- `handleMoveTo(parentId: string | null)` — performs the update with the given parent id.
- Bottom "Move to top level" calls `handleMoveTo(null)`.
- Row left-click calls `handleMoveTo(b.id)`.

## 3. Footer changes

- **Remove** the dynamic "Move into [current folder]" primary button.
- **Keep** a single primary action: **"Move to top level"**, shown only when `currentFolderId === null` (at root). Inside a folder, the move-into-current action is now redundant because the user reached this folder by clicking its chevron — to move into it they would click its title from the parent level.
  - Alternative considered: always show "Move to top level" regardless of depth, since the user may have drilled deep but still want root. We'll go with **always show "Move to top level"** (disabled when the block is already at root, i.e. `currentParentId === null`) for clarity.
- **Keep** Cancel button (left side of footer).
- Back button (already at top of list area) is unchanged.

## Technical details

- New helper `hasVisibleChildren(blockId)` reusing the same filter (excludes files blocks and completed blocks).
- Use native `<button>` for each zone with `type="button"` so keyboard/focus works; wrap them in a `flex items-stretch rounded` container with `divide-x divide-border` (or an explicit `w-px bg-border` element) so hover states stay independent.
- Loading state: while `moving === true`, disable all row buttons and the footer button to prevent double-submits.
- Toast + `onMoved()` calls remain identical.

## Out of scope

- No changes to `useBlocks`, breadcrumb component, or any caller of `MoveBlockModal`.
- No schema or RLS changes.
