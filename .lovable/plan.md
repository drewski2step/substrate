

## Plan: Fix expansion amount and add canvas shrink-on-release

### Changes — single file: `src/components/BlockFlowChart.tsx`

**1. Reduce EXPAND_AMOUNT**
- Change `EXPAND_AMOUNT` from `200` to `40` (line 47)
- Keep `EXPAND_THRESHOLD = 80` and throttle at 500ms unchanged

**2. Update all references to EXPAND_AMOUNT**
- The `handleDragNearEdge` handler already uses the constant, so the reduction propagates automatically to all four directions including the position shifts for up/left

**3. Add shrink-on-release logic**
- Create a new `handleDragEndWithShrink` wrapper that:
  1. Saves the dragged block's position (existing behavior via `updatePosition.mutate`)
  2. After saving, recalculates the minimum bounding box of all block positions
  3. Computes `minX`, `minY`, `maxX`, `maxY` across all blocks
  4. If `minX > EXPAND_THRESHOLD` — leftward space is reclaimable: shift all blocks left by `minX - EXPAND_THRESHOLD`, save shifted positions, reset `canvasExtra.left` to 0
  5. If `minY > EXPAND_THRESHOLD` — upward space is reclaimable: shift all blocks up by `minY - EXPAND_THRESHOLD`, save shifted positions, reset `canvasExtra.top` to 0
  6. Reset `canvasExtra.right` and `canvasExtra.bottom` to 0 — the container sizing already computes from max block positions, so the extra is no longer needed once the drag ends
- The canvas never shrinks smaller than the default grid minimum (`COLS * (BLOCK_W + GAP_X)` wide, 200px tall)

**4. Add CSS transition to canvas container**
- Add `transition: 'width 0.3s ease, height 0.3s ease'` to the inner relative div's style (line 621) so shrinking animates smoothly
- The transition is already disabled during drag via the BlockCard's own `transition: 'none'` when `dragOffset` is set

**5. Wire up the new drag-end handler**
- Replace the `onDragEnd` prop on BlockCard (line 639) to call the new `handleDragEndWithShrink` instead of directly calling `updatePosition.mutate`

### Files to edit
- `src/components/BlockFlowChart.tsx`

