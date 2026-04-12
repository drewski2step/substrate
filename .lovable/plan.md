

## Plan: Grid-based block layout that grows downward

### Summary
Refactor the flowchart from tier-based horizontal layout to a 3-column grid that grows downward, with stable ordering for existing blocks.

### Changes — single file: `src/components/BlockFlowChart.tsx`

**1. Update constants**
- `GAP_X = 24`, `GAP_Y = 24`, add `COLS = 3`

**2. Replace `computeDefaultPositions` with grid layout**
- Accept only blocks that have no saved position (auto-laid blocks)
- Sort auto-laid blocks by `created_at` ascending — oldest at top-left, newest at bottom-right
- Place in a 3-column grid: `col = index % 3`, `row = floor(index / 3)`
- `x = col * (BLOCK_W + GAP_X)`, `y = row * (BLOCK_H + GAP_Y)`

**3. Update positions computation (around line 500)**
- Split blocks into two groups: pinned (have saved position_x/position_y) and auto-laid (don't)
- Sort auto-laid by `created_at` ascending
- Pass auto-laid blocks to the new grid layout function
- Pinned blocks keep their exact saved coordinates

**4. Update container sizing (around line 515)**
- Width: use `100%` instead of computed maxX — set container to full parent width
- Height: still computed from max y position
- Remove the `width` style, let CSS handle it

**5. Fix overflow (line 565)**
- Change `overflow-x-auto` to `overflow-x-hidden` on the outer wrapper
- Remove horizontal scroll entirely

**6. Remove Foundation label** (line 586-591)
- The tier-based "Foundation" label no longer makes sense in a grid layout — remove it

**7. Remove unused tier functions**
- Remove `computeDepths`, `buildTiers` functions (no longer needed)

### Stable ordering rationale
Sorting auto-laid blocks by `created_at` ascending means existing blocks maintain their relative grid positions. When a new block is added, it appears last in the ascending sort, but since it has no saved position yet, it joins the auto-laid group at the end. The grid naturally accommodates it without shifting existing blocks — older blocks stay in their established positions and the new block fills the next available slot.

### What stays the same
- BlockCard, drag handle, drag-end persistence
- Files Block pinned at top
- AbsoluteConnectors (already uses positions map)
- All dialogs
- Works at every fractal level

### Files to edit
- `src/components/BlockFlowChart.tsx`

