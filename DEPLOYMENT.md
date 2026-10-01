# Vercel + Supabase

Vercel serves the Vite build and `/api` Express function. Supabase stores the data in the private `moimpyo` PostgreSQL schema. The browser never receives the database connection string.

## Setup

1. Run `server/schema.sql` once in the Supabase database.
2. Import this GitHub repository into Vercel using the Vite preset and Node.js 24.
3. Set sensitive server environment variable `DATABASE_URL` to the Supabase transaction pooler connection string (port 6543). Do not add SSL query parameters: the server verifies the certificate using `server/supabase-ca.crt`.
4. Set `TRUST_PROXY=1`. Vercel's `VERCEL_PROJECT_PRODUCTION_URL` supplies the allowed origin; set `APP_ORIGIN=https://your-domain` when using a custom domain.
5. Push to `main` to deploy updates automatically through the Vercel GitHub integration.

Local development keeps using SQLite unless `DATABASE_URL` is set. Existing local data is not uploaded automatically. GitHub Pages remains a frontend-only build; use Vercel for the full application.

Secrets belong only in Vercel environment settings or ignored `.env.*` files. The included CA certificate is public. Supabase anonymous/authenticated API roles cannot access the application's private tables.

Verification: `npm test` and `npm run build`. A local ignored `tests/.cloud-check.mjs` also exercises the same HTTP flows against the deployment database using `.env.deploy`; keep it private and run only on a designated test database.
