# Al Shifa Family Clinic

Independent pharmacy and clinic-management software for Dr. Saqlain Abbas Chattha.

## Run locally

1. Copy `.env.example` to `.env` and provide the Supabase URL and publishable key.
2. Apply the SQL files in `supabase/migrations` to the selected Supabase project.
3. Run `bun install` then `bun run dev`.

## Deploy on Cloudflare Workers

1. Sign in with `bunx wrangler login`.
2. Create a Supabase project, run the SQL files in `supabase/migrations` in chronological order, and copy its URL and publishable key.
3. In Cloudflare Workers, add these production environment variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Run `bun run deploy`. Cloudflare will return the production Worker URL.

In Supabase Authentication, set the **Site URL** to the Cloudflare production URL and add both the production URL and `https://your-domain/auth` to **Redirect URLs**. This is required for email confirmation and password login to use the same application database. Email confirmation links must be sent after this is saved; links from the deleted Lovable deployment will remain invalid for the new application.

The application uses the local `public/al-shifa-logo.svg` asset; it does not depend on a hosted Lovable asset or Lovable build configuration.
