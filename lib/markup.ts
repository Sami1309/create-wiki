import { slugify } from "./slug";

// Articles use wiki-style links: [[Page Title]] or [[Page Title|display text]].
// We turn those into normal Markdown links pointing at /wiki/<slug>, carrying the
// original title along as ?t= so the target page can generate with a clean title.

const WIKI_LINK = /\[\[([^\]]+)\]\]/g;

export function wikiToMarkdown(content: string): string {
  return content.replace(WIKI_LINK, (_match, inner: string) => {
    const [titlePart, displayPart] = inner.split("|");
    const title = titlePart.trim();
    const display = (displayPart ?? titlePart).trim();
    const slug = slugify(title);
    return `[${display}](/wiki/${slug}?t=${encodeURIComponent(title)})`;
  });
}

// Pull out every distinct page a piece of content links to, so we can create stubs.
export function extractLinks(content: string): { title: string; slug: string }[] {
  const out: { title: string; slug: string }[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  WIKI_LINK.lastIndex = 0;
  while ((match = WIKI_LINK.exec(content)) !== null) {
    const title = match[1].split("|")[0].trim();
    const slug = slugify(title);
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      out.push({ title, slug });
    }
  }
  return out;
}
