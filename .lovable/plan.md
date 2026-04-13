

## Plan: Fix white screen on published site

### Problem
The published site at thesubstrate.lovable.app crashes with `supabaseUrl is required.` because the Vite build that was deployed does not have the `VITE_SUPABASE_URL` environment variable embedded. The preview works fine because the dev server injects these at runtime.

### Fix
Make a trivial change to force a new build deployment:
- Add or update a harmless HTML comment in `index.html` (e.g., change the `<meta>` description or add a build timestamp comment)
- This triggers a fresh Vite build that will include the environment variables
- After the build completes, click **Publish → Update** to deploy the new build

### Files
- `index.html` — trivial edit to force rebuild

