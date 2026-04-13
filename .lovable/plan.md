

## Plan: Show creator avatar on every block card

### Problem
Creator info exists but is displayed as barely-visible 9px text ("by username"). The user wants a prominent avatar display on every block, similar to how pledged blocks show avatar circles.

### Changes

**`src/components/BlockFlowChart.tsx`**

1. Update the `BlockCard` props to accept `creatorAvatarSeed` in addition to `creatorName`
2. Add a creator avatar circle (using DiceBear) that always appears on each block card — positioned in the bottom-left of the card, showing the creator's robot avatar with a hover tooltip displaying their username
3. Update the batch profile fetch to also return `avatar_seed` (it already does — line 528)
4. Update the `creatorMap` to store `{ username, avatar_seed }` instead of just the username string
5. Pass both `creatorName` and `creatorAvatarSeed` when rendering each `BlockCard`
6. The avatar will be styled like the pledger avatars: small circle (w-5 h-5), border, hover tooltip with username

### Visual result
Every block card will show a small robot avatar in the bottom-left corner (next to the heat/discussion badges row), with the creator's username on hover — matching the visual language of the pledger avatars.

### Files to modify
- `src/components/BlockFlowChart.tsx` — update `creatorMap`, `BlockCard` props, and rendering

### No database or backend changes needed

