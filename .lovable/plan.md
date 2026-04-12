

## Plan: Add visibility toggle on mission page

### What needs to change

1. **Update `useUpdateGoal` type** in `use-goals.ts` — add `visibility` to the `Partial<Pick<...>>` so it can be updated via the mutation.

2. **Make the visibility badge clickable** in `MissionView.tsx`:
   - Replace the static badge with a clickable button for authenticated users
   - Clicking it toggles between public and private
   - When switching to private, show a confirmation dialog: "This mission will become invisible to non-members. Are you sure?"
   - When switching to public, apply immediately (no confirmation needed)
   - Save via `updateGoal.mutate` with `{ visibility: newValue }`

### Files to edit
- `src/hooks/use-goals.ts` — add `visibility` to update type
- `src/pages/MissionView.tsx` — make badge interactive with confirmation for going private

