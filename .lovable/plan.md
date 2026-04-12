

## Plan: Drag Handle + Draggable Blocks with Persistent Positions

### Summary

Refactor the flowchart from flex-based tier layout to absolute positioning with saved coordinates, add a visible drag handle, and make connectors track actual block positions.

### Changes

**1. Add drag handle to BlockCard** (`BlockFlowChart.tsx`)
- Import `GripVertical` from lucide-react
- Add a 6-dot grip icon (two columns of three dots) in the top-right corner of every block card
- Style: muted gray, `w-4 h-4`, purely visual — no button semantics
- Move `onMouseDown` from the card div to only the grip handle area
- Clicking elsewhere on the card navigates (existing `onClick` behavior preserved)
- Files blocks are already excluded from the flowchart, so no handle needed there

**2. Switch to absolute positioning layout** (`BlockFlowChart.tsx`)
- Replace the tier-based flex layout with a container using `position: relative`
- For each block: if `position_x`/`position_y` are set, place at those coordinates using `position: absolute`
- For blocks without saved positions, compute default positions from the existing tier layout algorithm (tier index × vertical spacing, slot index × horizontal spacing) and use those as initial coordinates
- On drag end, save the new absolute position via `useUpdateBlockPosition` (already wired)
- The container's height/width adjusts dynamically to fit all block positions

**3. Rewrite connectors to use actual coordinates** (`BlockFlowChart.tsx`)
- Replace `TierConnectors` with a single SVG overlay that spans the entire container
- For each dependency edge, draw a line from the source block's bottom-center to the target block's top-center using the blocks' known absolute positions
- Lines update immediately during drag (use the drag offset to compute in-flight positions)
- Keep existing styling: dashed for incomplete deps, solid for complete

**4. Keep Files Block behavior unchanged**
- Files Block is already filtered out of the flowchart blocks array
- It remains pinned at the top in its own styled row, never draggable

### Files to edit
- `src/components/BlockFlowChart.tsx` — all changes are in this single file

### No database changes needed
- `position_x` and `position_y` already exist on `blocks`
- `useUpdateBlockPosition` hook already saves positions correctly

