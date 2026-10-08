# Dress AI

A Next.js 16 application for shop-owned clothing catalogues and customer AI outfit previews.

The implemented flow is: owner sign-in → create a shop → upload garments once → share a shop or embed link → choose an existing garment → confirm photo consent → start FASHN processing → track and download the result.

## Current delivery status

Code, database migration and automated request-flow tests are implemented. The migration has been applied to the connected Dress AI Supabase project. Real paid image generation and a public deployment still require server-side credentials, confirmed FASHN credits and a connected hosting account. Do not describe mocked test images as real try-on results.

## Run locally

Use Node.js 22 or newer.

1. Run npm ci.
2. Copy .env.example to .env.local and set the Supabase publishable key.
3. Add a Supabase secret/service-role key and FASHN API key to server-only environment variables.
4. Run npm run dev.
5. Open http://localhost:3000/login, sign in and create the shop from the dashboard.
6. Add a garment, open the owner studio, and verify a real preview before enabling public previews.

Without the private credentials, sign-in and catalogue management can work; AI previews show a paused state. No mock provider is used by the public API.

## Data model and permissions

- dress_ai_shops: one shop per authenticated owner; public shop details.
- dress_ai_products: existing owner-scoped catalogue extended with shop ID, currency and visibility. A composite foreign key prevents assignment to another owner's shop.
- dress_ai_jobs: usage/tracking metadata only. Customer images are not stored here. Owners can read safe usage columns for their own shop; provider IDs, capability hashes and rate-limit hashes are server-only.
- dress_ai_reserve_job: SECURITY INVOKER RPC available only to service_role. An advisory transaction lock makes per-shop, per-IP and global daily reservations atomic across concurrent app instances.
- dress-ai-catalogue storage: public garment images, owner-prefixed write paths, restricted image types and a 3 MB upload limit.
- The old dresses demo table retains public catalogue reads but no longer permits anonymous inserts.

The checked-in migration is the record of the applied remote change. Do not rerun it against a project where it has already been applied. For a fresh project, first create the original dress_ai_products table and dress-ai-catalogue bucket from the existing schema, then apply the migration. No existing customer or garment rows were removed.

## AI processing and privacy

The default adapter uses FASHN Try-On Max, quality mode, 2k output and one image. It asks the model to preserve identity, body shape, pose and background, but these are model instructions, not a guarantee; real output quality must be checked with representative customer and garment photos. Set FASHN_MODEL=tryon-v1.6 explicitly for the alternative documented v1.6 adapter.

Customer photos are validated and re-encoded on the server, stripping EXIF/location metadata. They are sent as image data rather than a public customer-photo URL. Results request return_base64=true. The app keeps them in page memory and offers download and clear controls. Capability tokens are random, stored as hashes, expire after 60 minutes and are sent in a header instead of query strings. Clearing revokes app retrieval access and preserves usage records, so the daily cap cannot be bypassed by clearing.

FASHN's input processing and record/output retention remain subject to its own policy. Request records are not automatically deleted by FASHN. The product privacy page describes the actual boundaries.

References:
- https://docs.fashn.ai/api-reference/tryon-max
- https://docs.fashn.ai/api-reference/tryon-v1-6
- https://docs.fashn.ai/api-overview/api-fundamentals
- https://docs.fashn.ai/api-overview/data-retention-privacy

## Validation

Run npm run lint, npm run build and npm test.

The 11 request-flow integration tests start the built Next.js server against controlled Supabase/FASHN test endpoints. They exercise consent, authentication, cross-shop ownership, invalid images, body size, quotas, capability-only retrieval, expiration, clear behaviour and provider errors. They prove request wiring and guardrails; they do not prove real AI image generation.

tests/rls-isolation.sql verifies ownership and upload isolation and daily reservation limits against PostgreSQL using two existing accounts. It runs entirely inside a transaction and rolls back all fixtures. It was run successfully on the connected database. It must remain transaction-wrapped.

Desktop (1440 px) and mobile (390 px) browser checks passed for the landing/sign-in screens, owner catalogue/edit controls, photo consent, preview/result/download/clear and paused embedded view with controlled test data. No browser runtime errors or horizontal overflow were found.

Supabase security advisors found no database permission warnings after the migration. The existing project still has leaked-password protection disabled; enable it in Auth before a wider launch:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Deploy on Vercel

1. Connect the existing GitHub repository and deploy the codex/dress-ai-mvp branch as a preview, using the Next.js framework preset and Node.js 22 or newer.
2. Set the public Supabase URL/publishable key for the build. Add the Supabase secret key and FASHN API key as server-only deployment environment variables.
3. Set APP_URL to the HTTPS deployment origin. Add that origin and /login return URLs to Supabase Auth URL configuration; retain needed local URLs.
4. Keep PUBLIC_TRYON_ENABLED=false while verifying sign-in, garment upload, ownership isolation and one real owner preview.
5. Confirm FASHN credits. Quality 2k Max is documented as 4 credits per image; the app caps attempts, not monetary spend. Review caps before enabling customer traffic.
6. Set PUBLIC_TRYON_ENABLED=true only when customer processing is ready, redeploy and test the shop and embedded pages on a phone.
7. Verify confirmation/password-reset emails for the final origin, HTTPS, result download and quota errors.

This checkout contains no private API keys. .env.local is ignored. Never paste private credentials into GitHub files or public client environment variables.
