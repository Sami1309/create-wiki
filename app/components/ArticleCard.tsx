import Link from "next/link";
import type { CSSProperties } from "react";
import type { Page } from "@/lib/db";
import { excerpt } from "@/lib/excerpt";

export function ArticleCard({
  page,
  index = 0,
  featured = false,
}: {
  page: Page;
  index?: number;
  featured?: boolean;
}) {
  const code = String(index + 1).padStart(3, "0");
  const minutes = page.dwell_ms ? Math.round(page.dwell_ms / 60000) : 0;

  return (
    <Link
      href={`/wiki/${page.slug}`}
      prefetch={false}
      className={`card${featured ? " card-featured" : ""}`}
      style={{ "--i": index } as CSSProperties}
    >
      <div className="card-media">
        {page.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/image/${page.slug}`} alt="" loading="lazy" />
        ) : (
          <div className="card-media-empty">
            <span>{page.title.slice(0, 1)}</span>
          </div>
        )}
        <span className="card-code">No. {code}</span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{page.title}</h3>
        <p className="card-excerpt">{excerpt(page.content ?? "", featured ? 190 : 120)}</p>
        <div className="card-meta">
          <span>{page.views ?? 0} readings</span>
          {minutes > 0 && <span>· {minutes}m studied</span>}
        </div>
      </div>
    </Link>
  );
}
