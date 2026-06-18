# Create-Wiki — The Apocryphal Almanac

An AI-generated encyclopedia. Every article is written (and illustrated) on demand the
first time someone visits it, then cached forever in Postgres. Each page links to others —
and invents new related topics — so the wiki grows as you click around.

See **OVERVIEW.md** for the design and **SETUP.md** for the accounts/keys you need.

## Stack

- **Next.js** (App Router) — UI + server-side generation
- **Neon Postgres** — stores pages, the link graph, images, and popularity signals
- **OpenRouter** — one API key for both text (`anthropic/claude-opus-4.7`) and images
  (`x-ai/grok-imagine-image-quality`, aka Grok Imagine)

## Run locally

1. Put your secrets in `.env.local` (see `.env.example`):
   ```
   OPENROUTER_API_KEY=...      # used for BOTH text and images
   DATABASE_URL=...            # Neon pooled connection string
   ```
2. Install and start:
   ```bash
   npm install
   npm run dev
   ```
3. Open http://localhost:3000, type a title (or pick a sample prompt), and watch the
   article appear. Click any link to generate the next page.

The `pages` table is created/migrated automatically on first request — no migration step.

## Features

- **On-demand generation** with Opus 4.7; **illustrations** via Grok Imagine (best-effort —
  the article still renders if the image fails). Disable images with `IMAGES_ENABLED=false`.
- **Homepage** with card previews: a "Most pored over" shelf (ranked by reader attention)
  and a random "Wander in" shelf, plus one-click **sample prompts**.
- **Popularity / "PageRank-lite"** — every article tracks views and *dwell time* (how long
  readers actively stay). The homepage upranks by `views * 10 + seconds_read`. See
  OVERVIEW.md for how to extend this to true link-graph PageRank.
- **Spend safeguards** (configurable in `.env.local`):
  - `GEN_MAX_CONCURRENT` (default 2) — no more than N articles generated at once.
  - `GEN_MAX_PER_DAY` (default 100) — hard daily ceiling on new articles.
  - Same-page de-duplication: two readers opening the same new page trigger one generation.

## How it works

- `app/wiki/[slug]/page.tsx` — cache hit → serve + count a view; cache miss → check
  safeguards, claim a lock, generate text + image in parallel, save, create link stubs.
- `lib/generate.ts` — OpenRouter calls for the article and the illustration.
- `lib/db.ts` — Neon queries, schema migration, generation locks, popularity scoring.
  (The neon client uses `cache: "no-store"` so Next.js doesn't cache DB reads.)
- `lib/markup.ts` — converts `[[Wiki Links]]` into real links and extracts them for stubs.
- `app/api/image/[slug]` — serves stored images as bytes (so HTML stays small, images cache).
- `app/api/dwell` — receives dwell-time beacons from `DwellTracker`.

## Deploy to Vercel

1. Push to GitHub.
2. Import the repo at vercel.com.
3. Add `OPENROUTER_API_KEY` and `DATABASE_URL` as Environment Variables (plus any optional
   overrides: `OPENROUTER_MODEL`, `OPENROUTER_IMAGE_MODEL`, `IMAGES_ENABLED`,
   `GEN_MAX_CONCURRENT`, `GEN_MAX_PER_DAY`, `SITE_URL`).
4. Deploy.

> Generation can take 20–40s (Opus + image). The wiki route sets `maxDuration = 60`; make
> sure your Vercel plan allows that function duration.
