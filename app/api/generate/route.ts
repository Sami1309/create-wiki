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
} from "@/lib/db";
import { planArticle, streamArticleDeltas, illustrate } from "@/lib/generate";
import { extractLinks } from "@/lib/markup";
import { deslugify } from "@/lib/slug";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Opus + image generation can take a while

// Streams article generation to the client as newline-delimited JSON events:
//   {type:"image", src}      illustration is ready
//   {type:"noimage"}         no illustration (disabled or failed)
//   {type:"delta", text}     a chunk of article text
//   {type:"cached", content, image}   already generated; here it is
//   {type:"blocked", title, body}     a safeguard refused generation
//   {type:"error", message}  generation failed
//   {type:"done"}            finished
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!slug) return new Response("Missing slug", { status: 400 });

  await ensureSchema();
  const title =
    (typeof body.title === "string" && body.title.trim()) || deslugify(slug);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const serveCached = async (content: string, image: string | null) => {
        await incrementView(slug);
        send({ type: "cached", content, image });
        send({ type: "done" });
      };

      let holdingLock = false;
      try {
        // Maybe it already exists (or was generated since the page loaded).
        const existing = await getPage(slug);
        if (existing?.status === "generated" && existing.content) {
          await serveCached(
            existing.content,
            existing.image_url ? `/api/image/${slug}` : null
          );
          return;
        }

        // Safeguard 1: daily budget ceiling.
        if ((await countGeneratedToday()) >= config.maxPerDay) {
          send({
            type: "blocked",
            title: "Daily limit reached",
            body: `Create-Wiki has generated its maximum number of new articles for today (${config.maxPerDay}). Please try again tomorrow.`,
          });
          return;
        }

        // Claim the slug (also dedupes two readers opening the same new page).
        holdingLock = await claimGeneration(slug, title);
        if (!holdingLock) {
          const fresh = await getPage(slug);
          if (fresh?.status === "generated" && fresh.content) {
            await serveCached(
              fresh.content,
              fresh.image_url ? `/api/image/${slug}` : null
            );
            return;
          }
          send({
            type: "blocked",
            title: "This article is being written",
            body: "Another reader just requested this page. Wait a few seconds, then refresh.",
          });
          return;
        }

        // Safeguard 2: concurrency cap. We hold a lock, so the count includes us.
        if ((await countActiveGenerations()) > config.maxConcurrent) {
          await releaseGeneration(slug);
          holdingLock = false;
          send({
            type: "blocked",
            title: "Server busy",
            body: `Too many articles are being generated at once (limit ${config.maxConcurrent}). Please try again in a moment.`,
          });
          return;
        }

        // Plan: summary + relevant link targets.
        const candidates = await getCandidateTitles(slug, 150);
        const { summary, relevant } = await planArticle(title, candidates);

        // Illustration runs in parallel; emit it whenever it resolves.
        const imagePromise = illustrate(title, summary)
          .then((url) => {
            if (url) send({ type: "image", src: url });
            else send({ type: "noimage" });
            return url;
          })
          .catch(() => {
            send({ type: "noimage" });
            return null;
          });

        // Stream the article text token-by-token.
        let full = "";
        for await (const delta of streamArticleDeltas(title, relevant, summary)) {
          full += delta;
          send({ type: "delta", text: delta });
        }

        const imageUrl = await imagePromise;
        if (!full.trim()) throw new Error("The model returned an empty article.");

        // Persist: create stubs for new links, then save the finished page.
        await Promise.all(
          extractLinks(full).map((l) => createStub(l.slug, l.title))
        );
        await savePageGenerated(slug, title, full, imageUrl);
        holdingLock = false; // status is now 'generated'
        await incrementView(slug);

        send({ type: "done" });
      } catch (err: any) {
        if (holdingLock) await releaseGeneration(slug).catch(() => {});
        send({
          type: "error",
          message: err?.message
            ? String(err.message).slice(0, 200)
            : "Generation failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
