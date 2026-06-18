import { ensureSchema, getTopPages, getRandomPages } from "@/lib/db";
import { SearchBox } from "./components/SearchBox";
import { SamplePrompts } from "./components/SamplePrompts";
import { ArticleCard } from "./components/ArticleCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureSchema();

  const top = await getTopPages(6);
  const topSlugs = new Set(top.map((p) => p.slug));
  const pool = await getRandomPages(18);
  const random = pool.filter((p) => !topSlugs.has(p.slug)).slice(0, 9);

  const hasAny = top.length > 0 || random.length > 0;

  return (
    <main className="home">
      <div className="grain" aria-hidden />

      <header className="masthead">
        <p className="kicker">An encyclopedia of things that never were</p>
        <h1 className="wordmark">
          The Apocryphal
          <span className="wordmark-line">Almanac</span>
        </h1>
        <p className="lede">
          Every entry is conjured the moment it is sought. Name a subject — real,
          imagined, or impossible — and watch it be written into history.
        </p>
        <SearchBox />
        <SamplePrompts />
      </header>

      {top.length > 0 && (
        <section className="shelf">
          <h2 className="shelf-title">
            <span>Most pored over</span>
          </h2>
          <div className="card-grid">
            {top.map((p, i) => (
              <ArticleCard key={p.slug} page={p} index={i} featured />
            ))}
          </div>
        </section>
      )}

      {random.length > 0 && (
        <section className="shelf">
          <h2 className="shelf-title">
            <span>Wander in</span>
          </h2>
          <div className="card-grid">
            {random.map((p, i) => (
              <ArticleCard key={p.slug} page={p} index={i} />
            ))}
          </div>
        </section>
      )}

      {!hasAny && (
        <p className="empty">
          The shelves are bare. Be the first to summon an entry above.
        </p>
      )}

      <footer className="colophon">
        Written on demand by a machine · believe nothing
      </footer>
    </main>
  );
}
