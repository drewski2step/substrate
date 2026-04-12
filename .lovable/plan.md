

## Plan: Infinite canvas that expands in all four directions

### Summary
Make the block canvas expand dynamically when blocks are dragged near any edge, with position shifting for upward/leftward expansion, a visible dashed border, and full bi-directional scrolling.

### Changes — single file: `src/components/BlockFlowChart.tsx`

**1. Add constants and canvas state**
- `EXPAND_THRESHOLD = 80`, `EXPAND_AMOUNT = 200`
- Add `canvasExtra` state: `{ top: 0, right: 0, bottom: 0, left: 0 }` tracking extra space added
- Add a `lastExpandRef` ref to throttle expansions (minimum 500ms apart)

**2. Add `onDragNearEdge` callback to BlockCard**
- New prop on BlockCard: `onDragNearEdge?: (id: string, direction: 'up' | 'down' | 'left' | 'right') => void`
- During `mousemove` in the grip handler, compute the block's projected absolute position within the canvas
- If within 80px of any canvas edge, call `onDragNearEdge` with the appropriate direction

**3. Add canvas expansion handler in BlockFlowChart**
- `handleDragNearEdge(blockId, direction)`:
  - Check throttle ref — skip if last expansion was < 500ms ago
  - **Down**: increase `canvasExtra.bottom` by 200px (visual only, no position shifts)
  - **Right**: increase `canvasExtra.right` by 200px (visual only)
  - **Up**: increase `canvasExtra.top` by 200px, then shift ALL block positions down by 200px — for pinned blocks update their saved position_y, for auto-laid blocks compute their grid position and save as pinned. Batch-save all to DB.
  - **Left**: increase `canvasExtra.left` by 200px, shift ALL block positions right by 200px — same save logic as upward. Batch-save all to DB.

**4. Batch position save helper**
- Create `batchSavePositions(blocks, goalId, deltaX, deltaY)` that iterates over all blocks and calls `supabase.from("blocks").update({ position_x, position_y })` individually
- Add a code comment: `// TODO: Replace individual updates with a batch upsert when block counts grow large`

**5. Update container sizing**
- `containerWidth = max(all block x + BLOCK_W) + 40 + canvasExtra.right + canvasExtra.left`
- `containerHeight = max(all block y + BLOCK_H) + 40 + canvasExtra.bottom + canvasExtra.top`
- Set both as explicit `width` and `height` on the inner relative div

**6. Change overflow to `auto` on both axes**
- Replace `overflow-x-hidden` on line 536 with `overflow-auto`
- This enables scrolling in all directions when canvas exceeds viewport

**7. Add visible dashed border to canvas**
- Add `border border-dashed border-muted-foreground/20 rounded-lg` to the inner relative container div (line 537)

**8. Files Block unchanged**
- Files Block stays pinned above the scrollable canvas area, unaffected by expansion

### Position shift math
When expanding up: every block gets `position_y += 200`. When expanding left: every block gets `position_x += 200`. Auto-laid blocks without saved positions get their current grid-computed coordinates saved, converting them to pinned blocks. This is correct — expansion establishes absolute coordinates for all blocks.

### Files to edit
- `src/components/BlockFlowChart.tsx`

