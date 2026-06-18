# Create-Wiki

An AI-generated encyclopedia in the style of Wikipedia. A reader types (or clicks) a
title; if the article doesn't exist yet, an LLM writes and illustrates it on the spot,
saves it, and serves it. Every article links to others — and invents new related topics —
so the encyclopedia grows itself as people browse.

> **Design & voice:** see **[DESIGN_GUIDE.md](./DESIGN_GUIDE.md)** before changing any UI or
> the generation prompt. The short version: look and read like Wikipedia — minimal, white,
> serif headings, deadpan tech/SF-culture parody, no whimsy or showing off.

Other docs: **[OVERVIEW.md](./OVERVIEW.md)** (architecture & rationale),
**[SETUP.md](./SETUP.md)** (accounts/keys), **[README.md](./README.md)** (run/deploy).

## Stack

- **Next.js** (App Router, TypeScript) — UI + server-side generation in one app.
- **Neon Postgres** — single `pages` table: articles, the link graph, images, and
  popularity signals. Doubles as the cache.
- **OpenRouter** — one API key for the full-write model (`anthropic/claude-opus-4.7`), a
  cheap planning model (`anthropic/claude-haiku-4.5`), and images
  (`x-ai/grok-imagine-image-quality`, "Grok Imagine").

## Map

```
app/
  page.tsx                  Home: search, suggested prompts, "Most read" + "Random" panels
  layout.tsx                Root layout + metadata
  globals.css               ALL styling (Wikipedia-minimal; see DESIGN_GUIDE.md)
  wiki/[slug]/page.tsx      Article route: cache-hit → static serve, else hand to streamer
  wiki/[slug]/loading.tsx   Brief Suspense fallback while the route checks the cache
  wiki/[slug]/error.tsx     Server-side (DB) failure state
  components/
    SearchBox.tsx           Client: title → /wiki/<slug>?t=<title>
    SamplePrompts.tsx       Curated tech-parody starter links (plain <a>, never prefetched)
    ArticleCard.tsx         A list entry on the home panels
    StreamingArticle.tsx    Client: streams /api/generate, renders text live + image placeholder
    DwellTracker.tsx        Client: beacons active reading time → /api/dwell
  api/
    generate/route.ts       Streams generation (NDJSON): safeguards → plan → text ‖ image
    image/[slug]/route.ts   Serves stored base64 images as bytes (cacheable)
    dwell/route.ts          Accumulates dwell-time beacons
lib/
  config.ts                 Models + safeguard limits, all env-overridable
  db.ts                     Neon client, schema migration, queries, generation locks, scoring
  generate.ts               Generation pipeline: plan (summary + relevant-link filter) →
                            article write ‖ image-prompt → image. Holds SYSTEM_PROMPT.
  markup.ts                 [[Wiki Links]] → links; extract links to create stubs
  slug.ts                   title ↔ slug (slug is the canonical, de-duping key)
  excerpt.ts                Markdown → plain-text snippet for cards
  article.tsx               Renders article markdown (react-markdown)
```

## Core flows

- **Serve vs. generate:** `wiki/[slug]/page.tsx` — cache hit → static `ArticleView` +
  `incrementView`. Miss → render the `StreamingArticle` client component (title + skeletons
  paint immediately). Generation is **only** triggered when that component (real browser JS)
  POSTs to `/api/generate`, so prefetches/crawlers/curl never burn money.
- **Streaming generation (`api/generate/route.ts`):** runs the safeguards (daily cap →
  `claimGeneration` lock → concurrency cap), then `planArticle()` (the cheap pre-pass), then
  streams a `ReadableStream` of newline-delimited JSON events to the client:
  `delta` (article text chunk), `image`/`noimage`, `cached`, `blocked` (a safeguard refused),
  `error`, `done`. It writes link stubs + `savePageGenerated` at the end. `StreamingArticle`
  buffers `delta`s and flushes once per animation frame (smooth react-markdown re-render),
  shows a shimmer/spinner image placeholder until `image` arrives, and renders `blocked`/
  `error` as a Notice with a retry.
- **Generation pipeline (`lib/generate.ts`):** a cheap **plan pre-pass** (`planArticle`) on
  the planning model — `summarizeArticle` (a short factual outline) and `selectRelevantTitles`
  (Haiku filters the ~150 candidate titles down to genuinely relevant link targets, so the
  writer isn't handed every page and forced into irrelevant links). Then, in parallel: the
  Opus **streamed write** (`streamArticleDeltas`, seeded with the summary + relevant titles)
  and the **illustration** (`illustrate`: `writeImagePrompt` turns the same summary into a
  concrete image prompt → `generateImage`). Each plan step degrades gracefully (failure →
  title-only); a failed image never blocks the article.
- **Link graph:** generated content uses `[[Title]]`. Each linked title becomes a `stub` row
  (no content) until visited; visiting a stub generates it. This is how the wiki grows.
- **Popularity / ranking:** every view increments `views`; `DwellTracker` reports active
  reading time into `dwell_ms`. Home "Most read" ranks by `views * 10 + dwell_ms/1000`.
- **Images:** generated as base64 data URLs, stored in Postgres, served as raw bytes by
  `/api/image/[slug]` (immutable cache) so pages stay light. Best-effort: a failed image
  never blocks the article.

## Safeguards (env-tunable, `lib/config.ts`)

- `GEN_MAX_CONCURRENT` (default 2) — max simultaneous generations.
- `GEN_MAX_PER_DAY` (default 100) — hard daily ceiling. `0` pauses generation entirely.
- Per-slug generation lock prevents two readers double-generating the same new page.

## Env vars

Required: `OPENROUTER_API_KEY`, `DATABASE_URL`.
Optional: `OPENROUTER_MODEL`, `OPENROUTER_IMAGE_MODEL`, `IMAGES_ENABLED`,
`GEN_MAX_CONCURRENT`, `GEN_MAX_PER_DAY`, `SITE_URL`. See `.env.example`. Never commit
`.env.local`.

## Commands

```bash
npm run dev      # local dev at http://localhost:3000
npm run build    # production build (also typechecks)
npm start        # run the production build
```

## Conventions & gotchas

- **DB reads must not be cached by Next.** The neon client is created with
  `fetchOptions: { cache: "no-store" }` (in `lib/db.ts`). Without it, Next caches the neon
  HTTP query and replays a stale "not found", causing infinite regeneration. Don't remove it.
- **Internal links use `prefetch={false}`** (and sample prompts are plain `<a>`). Prefetching
  a not-yet-generated page would trigger generation before any click — and cost money.
- **Generation routes are `force-dynamic`** with `maxDuration = 60` (Opus + image is slow).
- **Schema auto-migrates** on first request via `ensureSchema()` (`CREATE TABLE` +
  `ADD COLUMN IF NOT EXISTS`); there is no separate migration step.
- **The slug is the identity.** Normalize titles through `slugify`; two titles with the same
  slug are the same page (intentional de-duplication).
