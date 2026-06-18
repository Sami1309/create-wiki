import Link from "next/link";
import type { Page } from "@/lib/db";
import { excerpt } from "@/lib/excerpt";

export function ArticleCard({ page }: { page: Page }) {
  const minutes = page.dwell_ms ? Math.round(page.dwell_ms / 60000) : 0;

  return (
    <Link href={`/wiki/${page.slug}`} prefetch={false} className="entry">
      {page.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="entry-thumb"
          src={`/api/image/${page.slug}`}
          alt=""
          loading="lazy"
        />
      ) : (
        <span className="entry-thumb entry-thumb-empty">
          {page.title.slice(0, 1)}
        </span>
      )}
      <span className="entry-body">
        <span className="entry-title">{page.title}</span>
        <span className="entry-excerpt">{excerpt(page.content ?? "", 120)}</span>
        <span className="entry-meta">
          {page.views ?? 0} views{minutes > 0 ? ` · ${minutes} min read` : ""}
        </span>
      </span>
    </Link>
  );
}
