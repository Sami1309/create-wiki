# Create-Wiki — Setup Checklist

Everything you need to sign up for and configure before writing code. Follow it top to
bottom. Total cost to get started: **$0 infra + a few dollars of LLM credit.**

When you're done you'll have four secrets in a `.env.local` file and a deployable app.

---

## At a glance

| # | What | Why | Cost | Time |
|---|---|---|---|---|
| 1 | **Anthropic API key** | The LLM that writes the articles | Pay-as-you-go (~$5 credit is plenty to start) | 5 min |
| 2 | **Neon** (Postgres DB) | Stores pages + the link graph (the cache) | Free tier | 5 min |
| 3 | **GitHub** account + repo | Source of truth; Vercel deploys from it | Free | 5 min |
| 4 | **Vercel** account | Hosts the Next.js app | Free Hobby tier | 5 min |
| 5 | **Node.js** (local) | Build/run the app on your machine | Free | 5 min |

> Don't have these? Start at step 1 and work down. Already have GitHub/Node? Skip those.

---

## 1. Anthropic API key (the LLM)

This is the only thing that actually costs money, and it's the core of the project.

1. Go to **https://console.anthropic.com** and sign up / log in.
2. **Billing → add a payment method** and buy a little credit (**$5 is more than enough**
   for an MVP — Haiku articles cost a fraction of a cent each).
3. **API Keys → Create Key.** Name it `create-wiki`.
4. **Copy the key now** (starts with `sk-ant-...`) — you can't view it again later.

Save it as:
```
ANTHROPIC_API_KEY=sk-ant-...
```

> **Model to use:** `claude-haiku-4-5-20251001` — cheap and fast, ideal for generating
> encyclopedia prose. You can swap to a Sonnet model later for higher-quality pages.

---

## 2. Neon — Postgres database (the cache/store)

The database holds every generated page so each article is only ever written once.

1. Go to **https://neon.tech** and sign up (GitHub login is easiest).
2. **Create a project** — name it `create-wiki`, accept the default region/Postgres version.
3. On the project dashboard, find **Connection string** and copy the **pooled** connection
   string (it looks like `postgresql://user:pass@...neon.tech/dbname?sslmode=require`).

Save it as:
```
DATABASE_URL=postgresql://user:pass@...neon.tech/dbname?sslmode=require
```

> **Alternative:** Supabase (https://supabase.com) also has a free Postgres tier — use it if
> you prefer its dashboard. Either works; you just need one `DATABASE_URL`.

---

## 3. GitHub — repo for the code

Vercel deploys straight from a GitHub repo, so put the project there.

1. Sign up / log in at **https://github.com**.
2. **Create a new repository** named `create-wiki` (private is fine).
3. Note the repo URL — you'll push to it once the code exists.

> No key needed here — Vercel connects to GitHub via OAuth in the next step.

---

## 4. Vercel — hosting

1. Go to **https://vercel.com** and **Sign up with GitHub** (one click, links the accounts).
2. Stay on the **Hobby (free)** plan — it covers an MVP.
3. You'll **Import** the `create-wiki` repo here once it's pushed. During import, Vercel asks
   for **Environment Variables** — add the same ones from your `.env.local` (step 6):
   - `ANTHROPIC_API_KEY`
   - `DATABASE_URL`

> Anything in `.env.local` must also be added in **Vercel → Project → Settings →
> Environment Variables**, or the deployed app won't have its secrets.

---

## 5. Node.js — local development

1. Install **Node.js 20 LTS or newer** from **https://nodejs.org** (or via `nvm`).
2. Verify:
   ```bash
   node --version   # should print v20.x or higher
   ```
3. (Optional) Have **Git** installed: `git --version`.

---

## 6. Wire up the secrets locally

In the project root, create a file named **`.env.local`**:

```bash
# .env.local  — NEVER commit this file
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://user:pass@...neon.tech/dbname?sslmode=require
```

And make sure it's ignored by git (Next.js does this by default, but confirm):

```bash
# .gitignore should contain:
.env*.local
```

---

## Secrets summary

The complete set of secrets the app needs:

| Variable | From | Used for |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Console (step 1) | Calling the LLM to write articles |
| `DATABASE_URL` | Neon / Supabase (step 2) | Connecting to Postgres |

That's it — two secrets. Everything else (Vercel, GitHub, Node) is account access, not keys.

---

## Optional accounts (not needed for the MVP)

Add these only if/when you want the matching feature:

- **Upstash Redis** (https://upstash.com, free tier) — for rate limiting generation
  (per-IP/day + a global daily cap) so a crawler can't run up your Anthropic bill. Worth
  adding **before** you make the site public.
- **Cloudflare** (https://cloudflare.com) — only if you later move hosting to Pages/Workers/D1
  (the cheaper-at-scale option from `OVERVIEW.md`).
- **A domain registrar** (Namecheap, Cloudflare Registrar, etc.) — when you want a custom
  domain instead of the free `*.vercel.app` URL.

---

## Ready check

You're ready to start building when you can answer **yes** to all of these:

- [ ] I have an `ANTHROPIC_API_KEY` and have added at least $5 of credit.
- [ ] I have a `DATABASE_URL` from Neon (or Supabase).
- [ ] I have a GitHub repo named `create-wiki`.
- [ ] I have a Vercel account linked to GitHub.
- [ ] `node --version` prints v20 or higher.
- [ ] Both secrets are in `.env.local`, and `.env*.local` is gitignored.

Once all six are checked, the next step is scaffolding the Next.js app (see `OVERVIEW.md`
§7 for the build checklist).
