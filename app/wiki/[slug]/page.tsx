import Link from "next/link";
import {
  ensureSchema,
  getPage,
  getCandidateTitles,
  savePageGenerated,
  createStub,
  claimGeneration,
  releaseGeneration,
  countActiveGenerations,
  countGeneratedToday,
  incrementView,
  type Page,
} from "@/lib/db";
import { generateArticle, generateImage } from "@/lib/generate";
import { extractLinks } from "@/lib/markup";
import { Article } from "@/lib/article";
import { deslugify } from "@/lib/slug";
import { config } from "@/lib/config";
import { DwellTracker } from "@/app/components/DwellTracker";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Opus + image generation can take a while

export default async function WikiPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { t?: string };
}) {
  await ensureSchema();
  const slug = params.slug;

  // Cache hit: serve and count a reading.
  const existing = await getPage(slug);
  if (existing && existing.status === "generated" && existing.content) {
    await incrementView(slug);
    return <ArticleView page={existing} />;
  }

  const title = searchParams.t?.trim() || existing?.title || deslugify(slug);
  const retryHref = `/wiki/${slug}${
    searchParams.t ? `?t=${encodeURIComponent(searchParams.t)}` : ""
  }`;

  // Safeguard 1: daily budget ceiling.
  if ((await countGeneratedToday()) >= config.maxPerDay) {
    return (
      <Notice
        title="The almanac rests"
        body={`Today's ${config.maxPerDay} new entries have all been written. The presses reopen tomorrow.`}
      />
    );
  }

  // Claim the slug (also dedupes two people opening the same new page at once).
  const claimed = await claimGeneration(slug, title);
  if (!claimed) {
    const fresh = await getPage(slug);
    if (fresh && fresh.status === "generated" && fresh.content) {
      await incrementView(slug);
      return <ArticleView page={fresh} />;
    }
    return (
      <Notice
        title="This entry is being written"
        body="Another reader summoned this page moments ago. Give it a few seconds, then refresh."
        retryHref={retryHref}
      />
    );
  }

  // Safeguard 2: concurrency cap. We now hold a lock, so the count includes us.
  if ((await countActiveGenerations()) > config.maxConcurrent) {
    await releaseGeneration(slug);
    return (
      <Notice
        title="The scriptorium is full"
        body={`Only ${config.maxConcurrent} entries may be written at once. Please try again in a moment.`}
        retryHref={retryHref}
      />
    );
  }

  // Generate article text and illustration in parallel.
  try {
    const candidates = await getCandidateTitles(slug);
    const [content, imageUrl] = await Promise.all([
      generateArticle(title, candidates),
      generateImage(title),
    ]);

    await Promise.all(extractLinks(content).map((l) => createStub(l.slug, l.title)));
    await savePageGenerated(slug, title, content, imageUrl);
    await incrementView(slug);

    return (
      <ArticleView
        page={{ slug, title, content, status: "generated", image_url: imageUrl }}
      />
    );
  } catch (err) {
    await releaseGeneration(slug);
    throw err; // handled by error.tsx
  }
}

function ArticleView({ page }: { page: Page }) {
  return (
    <main className="article">
      <div className="grain" aria-hidden />
      <DwellTracker slug={page.slug} />
      <nav className="topbar">
        <Link href="/" prefetch={false}>
          ⟵ The Apocryphal Almanac
        </Link>
      </nav>
      <article>
        <h1 className="article-title">{page.title}</h1>
        <p className="article-dateline">An entry conjured on demand</p>
        {page.image_url && (
          <figure className="hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/image/${page.slug}`} alt={page.title} />
            <figcaption>Illustration — {page.title}</figcaption>
          </figure>
        )}
        <div className="article-rule" />
        <Article content={page.content!} />
      </article>
    </main>
  );
}

function Notice({
  title,
  body,
  retryHref,
}: {
  title: string;
  body: string;
  retryHref?: string;
}) {
  return (
    <main className="article">
      <div className="grain" aria-hidden />
      <nav className="topbar">
        <Link href="/" prefetch={false}>
          ⟵ The Apocryphal Almanac
        </Link>
      </nav>
      <div className="notice">
        <h1 className="notice-title">{title}</h1>
        <p className="notice-body">{body}</p>
        {retryHref && (
          <a className="notice-action" href={retryHref}>
            Try again
          </a>
        )}
      </div>
    </main>
  );
}
