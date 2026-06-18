import { addDwell, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// Receives dwell-time beacons from the article page and accumulates them.
export async function POST(req: Request) {
  try {
    const text = await req.text();
    const { slug, ms } = JSON.parse(text || "{}");
    if (typeof slug === "string" && slug && typeof ms === "number" && ms > 0) {
      await ensureSchema();
      await addDwell(slug, Math.min(Math.round(ms), 10 * 60 * 1000));
    }
  } catch {
    // best-effort; never error on a beacon
  }
  return new Response(null, { status: 204 });
}
