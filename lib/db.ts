import { neon } from "@neondatabase/serverless";

// `fetchOptions: { cache: "no-store" }` is essential: the neon driver queries
// Postgres over HTTP using fetch, and Next.js would otherwise cache those
// responses and replay stale results (e.g. an empty "not found" from before a
// page existed).
const sql = neon(process.env.DATABASE_URL!, {
  fetchOptions: { cache: "no-store" },
});

export type PageStatus = "stub" | "generating" | "generated";

export type Page = {
  slug: string;
  title: string;
  content: string | null;
  status: PageStatus;
  image_url?: string | null;
  views?: number;
  dwell_ms?: number;
};

// Create the table (and add any newer columns) on first use. Memoized.
let schemaPromise: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS pages (
          id         BIGSERIAL PRIMARY KEY,
          slug       TEXT UNIQUE NOT NULL,
          title      TEXT NOT NULL,
          content    TEXT,
          status     TEXT NOT NULL DEFAULT 'stub',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Migrations for columns added after the first version.
      await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS image_url TEXT`;
      await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS dwell_ms BIGINT NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ`;
      await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS generation_started_at TIMESTAMPTZ`;
    })();
  }
  return schemaPromise;
}

export async function getPage(slug: string): Promise<Page | null> {
  const rows = await sql`
    SELECT slug, title, content, status, image_url, views, dwell_ms
    FROM pages WHERE slug = ${slug} LIMIT 1
  `;
  return (rows[0] as Page) ?? null;
}

// A random sample of existing titles to offer the LLM as link targets.
export async function getCandidateTitles(
  excludeSlug: string,
  limit = 25
): Promise<string[]> {
  const rows = await sql`
    SELECT title FROM pages
    WHERE slug <> ${excludeSlug}
    ORDER BY random()
    LIMIT ${limit}
  `;
  return rows.map((r: any) => r.title as string);
}

// Popularity score: time spent reading is the main signal (dwell_ms / 1000 =
// seconds), views a secondary one. This is what "uprank what people study" means.
export async function getTopPages(limit = 6): Promise<Page[]> {
  const rows = await sql`
    SELECT slug, title, content, status, image_url, views, dwell_ms FROM pages
    WHERE status = 'generated' AND content IS NOT NULL
    ORDER BY (views * 10 + dwell_ms / 1000.0) DESC, generated_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  return rows as Page[];
}

export async function getRandomPages(limit = 12): Promise<Page[]> {
  const rows = await sql`
    SELECT slug, title, content, status, image_url, views, dwell_ms FROM pages
    WHERE status = 'generated' AND content IS NOT NULL
    ORDER BY random()
    LIMIT ${limit}
  `;
  return rows as Page[];
}

// Persist a finished article (insert, or upgrade an existing stub/lock).
export async function savePageGenerated(
  slug: string,
  title: string,
  content: string,
  imageUrl: string | null
): Promise<void> {
  await sql`
    INSERT INTO pages (slug, title, content, image_url, status, generated_at)
    VALUES (${slug}, ${title}, ${content}, ${imageUrl}, 'generated', now())
    ON CONFLICT (slug) DO UPDATE
      SET content = EXCLUDED.content,
          image_url = EXCLUDED.image_url,
          title = EXCLUDED.title,
          status = 'generated',
          generated_at = now()
  `;
}

// Record a linked-to page that doesn't exist yet. Costs nothing until visited.
export async function createStub(slug: string, title: string): Promise<void> {
  await sql`
    INSERT INTO pages (slug, title, status)
    VALUES (${slug}, ${title}, 'stub')
    ON CONFLICT (slug) DO NOTHING
  `;
}

// ---------- Generation safeguards ----------

// Try to claim this slug for generation. Returns true only if we got the lock.
// Also prevents two requests generating the SAME page at once. A lock older than
// 120s is considered stale (previous attempt crashed) and may be re-claimed.
export async function claimGeneration(
  slug: string,
  title: string
): Promise<boolean> {
  const rows = await sql`
    INSERT INTO pages (slug, title, status, generation_started_at)
    VALUES (${slug}, ${title}, 'generating', now())
    ON CONFLICT (slug) DO UPDATE
      SET status = 'generating', generation_started_at = now()
      WHERE pages.status = 'stub'
         OR (pages.status = 'generating'
             AND pages.generation_started_at < now() - interval '120 seconds')
    RETURNING slug
  `;
  return rows.length > 0;
}

export async function releaseGeneration(slug: string): Promise<void> {
  await sql`
    UPDATE pages SET status = 'stub', generation_started_at = NULL
    WHERE slug = ${slug} AND status = 'generating'
  `;
}

export async function countActiveGenerations(): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS n FROM pages
    WHERE status = 'generating'
      AND generation_started_at > now() - interval '120 seconds'
  `;
  return (rows[0] as any).n as number;
}

export async function countGeneratedToday(): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS n FROM pages
    WHERE generated_at >= date_trunc('day', now())
  `;
  return (rows[0] as any).n as number;
}

// ---------- Popularity signals ----------

export async function incrementView(slug: string): Promise<void> {
  await sql`UPDATE pages SET views = views + 1 WHERE slug = ${slug}`;
}

export async function addDwell(slug: string, ms: number): Promise<void> {
  await sql`UPDATE pages SET dwell_ms = dwell_ms + ${ms} WHERE slug = ${slug}`;
}

export async function getImage(slug: string): Promise<string | null> {
  const rows = await sql`SELECT image_url FROM pages WHERE slug = ${slug} LIMIT 1`;
  return ((rows[0] as any)?.image_url as string) ?? null;
}
