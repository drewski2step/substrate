

## Plan: Force fresh production build

### Changes

1. **`index.html`** — Update build comment from `<!-- build 2026-04-13 -->` to `<!-- build 2026-04-13b -->`
2. **`src/main.tsx`** — Add `console.info('Substrate build 2026-04-13b');` before the `createRoot` call

After changes, click **Publish → Update** to deploy.

