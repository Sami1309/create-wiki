# Create-Wiki — Project Overview

An AI-generated "fake Wikipedia." Every article is written on demand by an LLM. Users
browse from page to page through hyperlinks, just like the real thing — except none of
it exists until someone asks for it.

---

## 1. Concept

- A user types a title or URL (e.g. `/wiki/The_Glass_Symphony_of_1847`).
- If that page doesn't exist yet, an LLM writes it — in encyclopedia style — and it's saved.
- Each generated page contains **hyperlinks to other pages**. Some link to articles that
  already exist; some point to topics that don't exist *yet* and get written the moment
  someone clicks them.
- The result is a wiki that grows organically and endlessly as people explore it.

The core trick is the **link graph**: when we generate a page, we hand the LLM a list of
other page titles it's allowed to link to, plus we ask it to invent a few *new* related
topics. Those new topics become clickable "stubs" — empty placeholders that cost nothing
until visited. This is what makes the wiki feel infinite and interconnected.

---

## 2. Core Mechanics

### The generation loop

```
        ┌─────────────────────────────────────────────────────┐
        │  User visits /wiki/<slug>                            │
        └─────────────────────────────────────────────────────┘
                              │
                  ┌───────────┴───────────┐
                  │  Page already exists?  │
                  └───────────┬───────────┘
                     yes      │      no
              ┌───────────────┘      └───────────────┐
              ▼                                       ▼
     Serve cached page                  1. Pick "linkable" titles
     (instant, $0)                         (sample of existing pages
                                            relevant to this title)
                                        2. Call LLM with title + that list
                                        3. LLM returns article body with
                                           [[wiki links]] + a few NEW
                                           proposed topics
                                        4. Save page; create stub rows for
                                           any linked title that doesn't
                                           exist yet
                                        5. Serve it (and cache forever)
```

### Two ways the graph grows

1. **Inward links** — we feed each new page a sample of *existing* titles so it links back
   into the wiki, keeping everything connected.
2. **Outward links (new stubs)** — we ask the LLM to also propose a few brand-new related
   topics. These are saved as title-only **stubs**. They're clickable ("red links"), and
   visiting one triggers its generation. Stubs cost nothing until clicked.

### Link syntax & rendering

- The LLM writes links in a simple `[[Page Title]]` wiki syntax (easy to parse, model-friendly).
- A renderer converts `[[Title]]` → `<a href="/wiki/slug">Title</a>`, normalizing the title
  to a slug (`"Quantum Banana"` → `quantum_banana`).
- Before linking, we **canonicalize/dedupe** titles (lowercase, trim, strip articles) so
  "The Quantum Banana" and "Quantum Banana" don't become two separate pages.

---

## 3. Architecture

Deliberately small. One app, one database, one LLM provider.

```
┌────────────────────────────────────────────────────────────────┐
│                         Browser (user)                          │
│   - Search box (type a title)                                   │
│   - Reads articles, clicks [[links]] to navigate                │
└───────────────────────────┬────────────────────────────────────┘
                            │ HTTP
                            ▼
┌────────────────────────────────────────────────────────────────┐
│             Web App  (Next.js — UI + API routes)                │
│                                                                 │
│   GET /wiki/[slug]                                              │
│     ├─ look up page in DB                                       │
│     ├─ if found → render                                        │
│     └─ if missing → call Generation Service, save, render       │
│                                                                 │
│   Generation Service (a server function/module)                 │
│     ├─ select candidate link titles from DB                     │
│     ├─ call LLM (Anthropic API)                                 │
│     ├─ parse [[links]], create stub rows                        │
│     └─ persist the finished page                                │
└──────────────┬──────────────────────────────┬──────────────────┘
              │                              │
              ▼                              ▼
   ┌────────────────────┐         ┌────────────────────────┐
   │   Database          │         │   LLM API (Anthropic)  │
   │   pages, links      │         │   writes the article   │
   └────────────────────┘         └────────────────────────┘
```

**Components**

| Component | Responsibility |
|---|---|
| **Frontend** | Article reading view, search/title input, loading state during generation. |
| **API routes** | Resolve a slug → page; orchestrate generation on cache miss. |
| **Generation service** | Build the prompt (title + linkable titles), call the LLM, parse output, create stubs. |
| **Database** | Persistent store of pages + the link graph. Doubles as the cache. |
| **LLM provider** | Anthropic API (Claude Haiku for cheap/fast generation). |

> **Key cost principle:** an article is generated **once** and then served from the DB
> forever. The database *is* the cache. No page is ever written twice.

---

## 4. Data Model (minimal)

```sql
-- One row per page (whether a full article or an unwritten stub)
pages (
  id          INTEGER PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,   -- "quantum_banana"
  title       TEXT NOT NULL,          -- "Quantum Banana"
  content     TEXT,                   -- article body (markdown/HTML); NULL if stub
  status      TEXT NOT NULL,          -- 'stub' | 'generated'
  created_at  TIMESTAMP DEFAULT now()
)

-- Optional but useful: explicit edges for "what links to what"
links (
  from_page_id INTEGER REFERENCES pages(id),
  to_title     TEXT,                  -- resolve to a page/stub on read or write
  PRIMARY KEY (from_page_id, to_title)
)
```

- **Stubs** are just `pages` rows with `status = 'stub'` and `content = NULL`.
- Links can be stored explicitly in the `links` table, or simply parsed from `content` at
  render time. For an MVP, parsing from content is enough — add the `links` table later if
  you want backlinks ("what links here") or graph analytics.

---

## 5. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **App framework** | **Next.js** (React) | UI + API in one deployable. SSR makes generated pages cacheable & SEO-friendly. |
| **Language** | TypeScript | One language front-to-back. |
| **Database** | **Postgres** via Neon or Supabase (free tier) | Generous free tier, serverless, zero ops. SQLite/Turso is an even cheaper alternative. |
| **LLM** | **Anthropic API — Claude Haiku** | Fast + inexpensive; quality is plenty for encyclopedia prose. Upgrade to Sonnet for marquee pages if desired. |
| **Hosting** | **Vercel** (Hobby/free) | One-command deploy of Next.js, free tier covers an MVP. |

This stack means **one repo, one deploy, one DB connection string, one API key.**

---

## 6. Hosting Options — cheap & effective

Ranked for a low-cost MVP. All three can run an early-stage version for **~$0/month plus
LLM usage**.

### Option A — Vercel + Neon/Supabase  ⭐ recommended
- **What:** Next.js on Vercel (free Hobby tier); Postgres on Neon or Supabase (free tier).
- **Pros:** Simplest path. Push to GitHub → auto-deploy. Mature, well-documented.
- **Cons:** Serverless function timeouts (~10–60s) mean long generations should **stream**
  output rather than block. Free tiers have soft limits but are fine for an MVP.
- **Cost:** $0 infra to start; you only pay for LLM tokens.

### Option B — Cloudflare (Pages + Workers + D1)
- **What:** Front end on Pages, API on Workers, SQLite-style DB on D1.
- **Pros:** Extremely cheap at scale, fast global edge, generous free tier.
- **Cons:** Worker runtime constraints; slightly more assembly than the Vercel path.
- **Cost:** $0 to start; cheapest as traffic grows.

### Option C — Single VPS (Fly.io / Railway / Render)
- **What:** Run the Next.js app + Postgres on one small instance/container.
- **Pros:** No serverless timeout limits — long generations can just run. Full control.
- **Cons:** You manage the box; ~$5/month even when idle.
- **Cost:** ~$5/month + LLM usage.

**Recommendation:** Start with **Option A (Vercel + Neon)** for speed of setup. If LLM
streaming within serverless limits becomes annoying, move the generation endpoint to
**Option C** (a small always-on container) without changing the rest.

### The real cost driver: LLM tokens
- Infra is effectively free at MVP scale. **Your bill is LLM generation.**
- Because each page is generated **once and cached forever**, cost scales with *unique
  pages created*, not with page views. A million views of 1,000 articles ≈ 1,000 generations.
- With a cheap model like Claude Haiku, a ~800-word article is a fraction of a cent.
  Even thousands of articles cost only a few dollars.
- **Guardrails worth adding early:** a per-IP/day generation rate limit and a global daily
  generation cap, so a crawler or a bored visitor can't run up the API bill.

---

## 7. Minimal MVP — what's needed to get running

The smallest thing that demonstrates the whole idea:

**Prerequisites**
1. An **Anthropic API key**.
2. A **Postgres database** (Neon/Supabase free tier — just a connection string).
3. A **Vercel account** linked to a GitHub repo.

**Build checklist**
- [ ] Next.js app with one dynamic route: `GET /wiki/[slug]`.
- [ ] `pages` table (slug, title, content, status).
- [ ] **Generation function:** given a title, select ~10–20 existing titles as link
      candidates, call the LLM, get back article body in `[[link]]` syntax.
- [ ] **Slug/title normalization** so links resolve and dedupe correctly.
- [ ] On cache miss: generate → save → render. On hit: render from DB.
- [ ] **Link renderer:** turn `[[Title]]` into `<a href="/wiki/slug">`; auto-create stub
      rows for titles that don't exist yet.
- [ ] A **home page / search box** to type the first title and seed the wiki.
- [ ] A **loading state** ("Researching this topic…") shown during generation.

**Explicitly NOT needed for the MVP** (add later):
- User accounts / auth
- Editing or moderation
- Search across article *content* (title navigation is enough to start)
- Embeddings-based "related pages" (a random/recent sample of titles works at first)
- A "what links here" backlinks page
- Streaming generation (nice UX, but a blocking spinner is fine to prove the concept)

**The end-to-end MVP loop:** type a title → watch the LLM write the article → click a
hyperlink inside it → watch *that* article get written → repeat forever.

---

## 8. The Generation Prompt (sketch)

The heart of the system. Roughly:

> **System:** You are writing a single encyclopedia article in a neutral, factual
> Wikipedia style. The subject may be entirely fictional — treat it as real and write with
> authority. Use `[[Page Title]]` syntax to link related concepts. You may link to any of
> the provided existing titles, and you should also introduce 3–6 *new* related topics as
> `[[links]]` to encourage exploration.
>
> **User:** Title: `{title}`
> Existing pages you may link to: `{sampled list of titles}`
> Write the article.

Optionally request **structured output** (JSON: `{ content, suggested_links[] }`) so stub
creation doesn't rely on parsing prose.

---

## 9. Future Enhancements

- **Coherence:** a lightweight "world bible" or shared facts table so articles stay
  mutually consistent (dates, names, places).
- **Smarter link selection:** embeddings/full-text search to pick *relevant* existing
  titles instead of a random sample → a denser, more sensible graph.
- **Streaming generation** for a "watch it write" experience.
- **Categories, infoboxes, images** (image generation for thumbnails).
- **"Random article"** and a graph/visualization of the wiki.
- **Editing & versioning** if you ever want human contributions.

---

## TL;DR

A Next.js app on Vercel, a free Postgres DB, and an Anthropic API key. Pages are written by
Claude on first visit and cached forever; each page links to others (and invents new stub
topics) via a `[[wiki link]]` syntax, so the encyclopedia grows itself as people click
around. Infra is ~$0 to start; the only real cost is LLM tokens, and that scales with
*unique pages*, not traffic — so cache aggressively and rate-limit generation.
