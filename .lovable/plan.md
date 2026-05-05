## Add "Move here" button to MoveBlockModal

Update `src/components/MoveBlockModal.tsx` footer to add a primary "Move here" button alongside the existing Cancel button.

### Change

In the `<DialogFooter>` block (currently only contains Cancel), add a "Move here" button:

```tsx
<DialogFooter>
  <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
  <Button
    size="sm"
    disabled={moving}
    onClick={() => handleMoveTo(currentFolderId)}
  >
    Move here
  </Button>
</DialogFooter>
```

### Behavior

- Always visible at any depth.
- `currentFolderId` is already computed as `path.length > 0 ? path[path.length - 1].id : null`, so it correctly resolves to `null` at root or the current folder's id when drilled in.
- Reuses existing `handleMoveTo`, which already handles the no-op case (`newParentId === currentParentId` shows "Block is already there" toast) and success path.

No other changes to the component, props, imports, or Supabase logic.