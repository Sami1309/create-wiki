import { ensureSchema, getImage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Serves an article's illustration. Images are stored in Postgres as base64 data
// URLs; this decodes and returns the raw bytes so pages don't inline megabytes of
// base64 (and so browsers can cache the image).
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  await ensureSchema();
  const url = await getImage(params.slug);
  if (!url) return new Response("Not found", { status: 404 });

  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(url);
  if (!m) {
    // Already an external URL — just redirect to it.
    return Response.redirect(url, 302);
  }

  const body = Buffer.from(m[2], "base64");
  return new Response(body, {
    headers: {
      "Content-Type": m[1],
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
