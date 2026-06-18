// Calls OpenRouter (OpenAI-compatible) to plan, write, and illustrate an article.
//
// Pipeline (see generatePage):
//   1. Cheap pre-pass (planModel, e.g. Haiku), run in parallel:
//        - summarizeArticle: a short factual plan of what the article covers.
//        - selectRelevantTitles: filter the big list of existing pages down to
//          the few that are actually relevant link targets (avoids dumping every
//          page on the writer and getting forced, irrelevant links).
//   2. With the plan in hand, run in parallel:
//        - generateArticle (textModel, e.g. Opus): the full write.
//        - illustrate: writeImagePrompt (planModel) turns the plan into a
//          concrete image prompt, then generateImage runs the image model.

import { config } from "./config";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are writing articles for "Create-Wiki", an encyclopedia in the exact format and register of Wikipedia.

Write a single article about the title the user provides. The subject may be real, fictional, or an absurd exaggeration — write about it perfectly straight, with a strictly neutral, encyclopedic, matter-of-fact tone, exactly as Wikipedia would.

Tone and style (important):
- Plain, dry, factual prose with a neutral point of view. NO whimsical, theatrical, ornate, or showing-off language. No purple prose, no flourishes, no dramatic narration, no winking at the reader.
- If anything is funny, the humor must be entirely deadpan — it comes ONLY from describing an absurd thing in a completely serious, encyclopedic register, never from jokey or playful wording.
- Lean toward software, computing, startups, the internet, and science-fiction/tech culture — the kinds of topics and in-jokes that people in tech and SF find funny or interesting. Treat jargon, tools, trends, and rituals as if they were genuinely notable encyclopedic subjects (movements, institutions, historical events, standards, phenomena).

Format (match Wikipedia):
- Output GitHub-flavored Markdown.
- Open with a lead paragraph that defines the subject in its first sentence. Do NOT repeat the title as a heading.
- Use "## Section" headings such as History, Overview, Design, Implementation, Adoption, Reception, Criticism, or Legacy — whatever fits the subject.
- Aim for roughly 350-650 words.

Linking (this is what makes the wiki explorable):
- Use [[Page Title]] or [[Page Title|display text]] for internal links.
- Link to the existing pages the user lists wherever they fit naturally — but only where genuinely relevant. Do not force links.
- ALSO introduce 3-6 NEW related topics as [[links]], preferring computing / internet / startup / SF-culture-adjacent subjects.
- Weave links naturally into sentences. Do not output a bare list of links.`;

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": config.siteUrl,
    "X-Title": "Create-Wiki",
  };
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

// Single place for an OpenRouter chat call. Throws on a non-OK response.
async function chat(
  model: string,
  messages: Msg[],
  extra: Record<string, unknown> = {}
): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    cache: "no-store",
    headers: headers(apiKey),
    body: JSON.stringify({ model, messages, ...extra }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter request failed (${res.status}). ${text.slice(0, 300)}`
    );
  }
  return res.json();
}

function textOf(data: any): string {
  return (data?.choices?.[0]?.message?.content ?? "").trim();
}

// ---------- Step 1: cheap planning pre-pass (planModel) ----------

// A short, factual outline of what the article covers. Shared by the writer and
// the image-prompt step so the picture matches the article. Returns "" on failure
// (the article and image can still be produced from the title alone).
export async function summarizeArticle(title: string): Promise<string> {
  const sys = `You plan encyclopedia articles. In 2-4 plain, factual sentences, describe what an article with the user's title would cover: what the subject is, and the key aspects the article should address. Neutral and concrete, like the lead of a Wikipedia article. No preamble, no markdown — just the summary.`;
  const data = await chat(config.planModel, [
    { role: "system", content: sys },
    { role: "user", content: title },
  ]);
  return textOf(data);
}

// Filter the candidate titles down to the ones an article on `title` would
// plausibly link to. Uses numbered indices so the model can't invent titles.
export async function selectRelevantTitles(
  title: string,
  candidates: string[]
): Promise<string[]> {
  if (candidates.length === 0) return [];
  // Too few to bother spending a model call on.
  if (candidates.length <= 8) return candidates;

  const numbered = candidates.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const sys = `You curate link targets for an encyclopedia. You are given a NEW article title and a numbered list of EXISTING article titles. Pick only the existing titles that an article on the new title would genuinely link to (same field, closely related concept, related tool/person/event/movement). Be selective — most lists will have only a handful of real matches, and forcing irrelevant links is worse than picking none. Reply with ONLY a JSON array of the chosen numbers, e.g. [2,5,9]. Pick at most 12. If none fit, reply [].`;
  const user = `New article title: ${title}\n\nExisting titles:\n${numbered}`;

  const data = await chat(config.planModel, [
    { role: "system", content: sys },
    { role: "user", content: user },
  ]);
  const raw = textOf(data);

  const nums = (raw.match(/\d+/g) ?? []).map((n) => parseInt(n, 10));
  const picked: string[] = [];
  const seen = new Set<number>();
  for (const n of nums) {
    if (n >= 1 && n <= candidates.length && !seen.has(n)) {
      seen.add(n);
      picked.push(candidates[n - 1]);
    }
  }
  return picked.slice(0, 12);
}

// ---------- Step 2a: the full article (textModel), streamed ----------

function buildArticlePrompt(
  title: string,
  relevantTitles: string[],
  summary: string
): string {
  const list =
    relevantTitles.length > 0
      ? relevantTitles.map((t) => `- ${t}`).join("\n")
      : "(no closely related pages exist yet — invent your own related topics to link to)";

  const planBlock = summary
    ? `Planned summary of the article (expand this into the full piece):\n${summary}\n\n`
    : "";

  return `Title: ${title}

${planBlock}Existing pages you may link to where relevant:
${list}

Write the full article now.`;
}

// Stream the article token-by-token. Yields content deltas as they arrive from
// the model (OpenRouter SSE). Throws on a non-OK response.
export async function* streamArticleDeltas(
  title: string,
  relevantTitles: string[],
  summary = ""
): AsyncGenerator<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    cache: "no-store",
    headers: headers(apiKey),
    body: JSON.stringify({
      model: config.textModel,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildArticlePrompt(title, relevantTitles, summary) },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter request failed (${res.status}). ${text.slice(0, 300)}`
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue; // skip SSE keepalive comments
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield delta;
      } catch {
        // ignore partial/non-JSON lines
      }
    }
  }
}

// ---------- Step 2b: image prompt (planModel) → image (imageModel) ----------

function fallbackImagePrompt(title: string): string {
  return `A clear, neutral, documentary illustration for an encyclopedia article titled "${title}" — like a Wikipedia photograph, diagram, or schematic on a plain background. Informative, not artistic or whimsical. No text, captions, labels, or watermark.`;
}

// Turn the article plan into one concrete image-generation prompt.
export async function writeImagePrompt(
  title: string,
  summary: string
): Promise<string> {
  const sys = `You write prompts for an image generator that illustrates encyclopedia articles. Given an article title and summary, write ONE concrete visual prompt for a single image to sit in the article's infobox — like a real Wikipedia photograph, diagram, schematic, or portrait. Name the concrete subject, composition, setting, and visual style. It must look documentary and neutral: not artistic, not whimsical, no fantasy styling (unless the subject itself is fictional technology, in which case depict it plausibly, as if real). The image must contain NO text, captions, labels, watermark, or UI. Reply with ONLY the prompt as a single paragraph, no preamble.`;
  const user = summary ? `Title: ${title}\n\nSummary: ${summary}` : `Title: ${title}`;
  const data = await chat(config.planModel, [
    { role: "system", content: sys },
    { role: "user", content: user },
  ]);
  return textOf(data) || fallbackImagePrompt(title);
}

// Best-effort illustration. Returns a data URL (or external URL), or null on any
// failure — the article is still served without an image.
export async function generateImage(prompt: string): Promise<string | null> {
  if (!config.imagesEnabled) return null;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      cache: "no-store",
      headers: headers(apiKey),
      body: JSON.stringify({
        model: config.imageModel,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image"],
      }),
    });

    if (!res.ok) {
      console.error(`Image gen failed (${res.status}):`, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    const url: unknown = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return typeof url === "string" && url.length > 0 ? url : null;
  } catch (err) {
    console.error("Image gen error:", err);
    return null;
  }
}

// Plan an image prompt from the summary, then generate the image. Best-effort.
export async function illustrate(
  title: string,
  summary: string
): Promise<string | null> {
  if (!config.imagesEnabled) return null;
  let prompt: string;
  try {
    prompt = await writeImagePrompt(title, summary);
  } catch {
    prompt = fallbackImagePrompt(title);
  }
  return generateImage(prompt);
}

// ---------- Planning pre-pass ----------

// Cheap pre-pass: plan a summary and pick the relevant link targets, in parallel.
// Each step degrades gracefully (failure → title-only / a small fallback slice).
export async function planArticle(
  title: string,
  candidateTitles: string[]
): Promise<{ summary: string; relevant: string[] }> {
  const [summary, relevant] = await Promise.all([
    summarizeArticle(title).catch(() => ""),
    selectRelevantTitles(title, candidateTitles).catch(() =>
      candidateTitles.slice(0, 12)
    ),
  ]);
  return { summary, relevant };
}
