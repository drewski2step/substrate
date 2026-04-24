

## Plan: Fix block resize so blocks stay at the dragged size

### The bug

The current resize math on the top-left handle is **inverted opposite to user intuition**, and that combined with the position-compensation write makes the block visually "snap back to original shape."

In `BlockFlowChart.tsx` lines 209–227 the handler does:
```
newW = startW - (clientX - startX)   // dragging right SHRINKS the block
newH = startH - (clientY - startY)   // dragging down SHRINKS the block
```

So when the user drags the top-left corner *outward* in the natural "make it bigger" direction (down and to the right of the handle, toward the cursor's general motion), the block actually **shrinks**, while the position-compensation `dx = startW - newW` simultaneously translates the block *toward* the cursor — making it look momentarily like the block is following the cursor and growing, when in fact it's shrinking and shifting.

On pointer-up the handler then writes the (now smaller) width/height AND the shifted position. After the React Query refetch the user sees: top-left anchored at the dragged position (because position was saved), but the bottom-right "snapped back inward" (because width was actually saved smaller, not larger).

The DB confirms this: out of 114 blocks, the one row with width/height has `width=160, height=80` — exactly `RESIZE_MIN_W × RESIZE_MIN_H`, the minimum clamp. Every resize attempt has been collapsing to the minimum.

### The fix

For a top-left resize handle that behaves like Canva / Figma / Google Slides, the correct math is:

- Drag handle **up and to the left** (away from the bottom-right anchor) → block grows
- Drag handle **down and to the right** (toward the bottom-right anchor) → block shrinks

That means:
```
newW = startW - (clientX - startX)   // ← keep: left motion (negative dx) grows
newH = startH - (clientY - startY)   // ← keep: up motion (negative dy) grows
```

That direction *is* what the code currently does. The actual bug is more subtle and lives in the **position compensation + the write order**, plus mismatched state during the refetch window. Concrete changes:

1. **Keep the inverted math (up/left grows)** — this matches the spec the user previously approved and is correct for a top-left handle.

2. **Fix the position compensation sign.** Currently `dx = startW - newW`. When the block grows (newW > startW), `dx` is negative, and the live `transform: translate(dx, dy)` shifts the block up-left so the bottom-right stays anchored — correct visually. But on `onResizeEnd`, the parent computes `newX = curPos.x + dx`. With `dx` negative this reduces `position_x` — also correct. Verified the math is internally consistent.

3. **Real root cause — the write race.** `onResizeEnd` fires two separate mutations (`updateSize.mutate` + `updatePosition.mutate`) and clears `liveSizes` / `liveOffsets` *immediately*. React Query's optimistic state for the `["blocks", goalId]` query is not updated synchronously — there's a window (typically 50–300ms while the PATCH round-trips) where the cached block still has the OLD `width`/`height` but the parent has already cleared `liveSizes`. During that window the block re-renders at the old size, at the new shifted position — i.e. it visually "snaps back" with the bottom-right pulling inward. When the refetch completes the new size lands and it jumps again. The user perceives this as the block returning to its original shape.

   **Fix:** in `onResizeEnd`, do not clear `liveSizes` / `liveOffsets` for that block id until the `updateSize` mutation `onSuccess` resolves AND the new query data containing the new width/height is back in the cache. Concretely:
   - Keep the live override entry in `liveSizes` and `liveOffsets` after pointer-up.
   - Pass an `onSuccess` callback to `updateSize.mutate(...)` that, after the query invalidation completes (await `queryClient.invalidateQueries(...).then(...)`), removes that block id from the two live maps.
   - This makes the visual size persist seamlessly across the network round-trip — no snap-back window.

4. **Single-mutation write for atomicity.** Replace the two separate `updateSize` + `updatePosition` calls in the parent's `onResizeEnd` with a single `updateBlock.mutate` call that writes `{ width, height, position_x, position_y }` together. This guarantees the server row is consistent (no partial state where size changed but position didn't or vice versa) and eliminates the case where one mutation succeeds and the other silently fails.

5. **Ensure the BlockCard's `startW` / `startH` always read the current effective size**, not a stale render value. Replace the `useCallback`-captured `w` / `h` with refs (`wRef`, `hRef`) updated each render, and read `wRef.current` / `hRef.current` inside `handleResizePointerDown`. This protects against the rare case where the callback was re-bound mid-interaction.

### Files to edit

- **`src/components/BlockFlowChart.tsx`**
  - In `BlockCard`: switch `startW` / `startH` to read from refs that mirror `w` / `h` each render.
  - In the parent component's `onResizeEnd` handler: replace the two-mutation write with a single `updateBlock.mutate({ id, goalId, updates: { width, height, position_x, position_y } })` call, and only delete the entry from `liveSizes` / `liveOffsets` inside that mutation's `onSuccess`.

- **`src/hooks/use-blocks.ts`**
  - No new hook needed — `useUpdateBlock` already accepts arbitrary fields via `updates: Partial<...> & Record<string, any>`. Just make sure the type union in the `updates` parameter explicitly lists `width`, `height`, `position_x`, `position_y` for editor autocomplete (cosmetic only — the `Record<string, any>` already allows it at runtime).

### What stays untouched

Top-left handle position, hover-only visibility, SVG diagonal indicator, drag-to-reposition via the top-right grip, completion → brick collapse, dependency arrows (they already read from `liveSizes` / `liveOffsets` while those entries exist, so keeping the live entries until the refetch lands keeps the arrows glued correctly), Files Block exclusion, RLS, all other functionality.

### Verification after implementation

1. Resize a block by dragging the top-left handle up-left → block grows during drag.
2. Release → block stays at the new larger size, with the bottom-right edge in the same screen position it had during the drag.
3. Refresh the page → block renders at the saved larger size at the saved position.
4. SQL check: `SELECT count(width) FROM blocks` should grow with each resize attempt, and saved values should reflect actual sizes (not just `160×80`).

