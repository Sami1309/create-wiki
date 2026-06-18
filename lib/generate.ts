// Calls OpenRouter (OpenAI-compatible) to write an article and illustrate it.

import { config } from "./config";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are an author for an encyclopedia written in the style of Wikipedia.

Write a single encyclopedia article about the title the user gives you. The subject may be entirely fictional, alternate-history, or absurd — treat it as completely real and write with calm, neutral, factual authority, exactly as a real encyclopedia would.

Formatting:
- Output GitHub-flavored Markdown.
- Begin directly with the opening paragraph. Do NOT repeat the title as a top-level heading.
- Use a few "## Section" headings (e.g. History, Overview, Legacy, Reception) like a real article.
- Aim for roughly 350-650 words.

Linking (important — this is what makes the wiki explorable):
- Link related concepts using double-bracket wiki syntax: [[Page Title]], or [[Page Title|display text]] to show different text.
- Link to several of the "existing pages" the user lists, wherever it's relevant.
- ALSO invent 3-6 NEW related topics and link to them as [[links]], even if they are not in the list.
- Weave links naturally into sentences. Do not output a bare list of links.`;

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": config.siteUrl,
    "X-Title": "Create-Wiki",
  };
}

export async function generateArticle(
  title: string,
  candidateTitles: string[]
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const list =
    candidateTitles.length > 0
      ? candidateTitles.map((t) => `- ${t}`).join("\n")
      : "(no other pages exist yet — invent your own related topics to link to)";

  const userPrompt = `Title: ${title}

Existing pages you may link to:
${list}

Write the article now.`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    cache: "no-store",
    headers: headers(apiKey),
    body: JSON.stringify({
      model: config.textModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}). ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new Error("LLM returned an empty article.");
  }
  return content.trim();
}

// Best-effort illustration. Returns a data URL (or external URL), or null on any
// failure — the article is still served without an image.
export async function generateImage(title: string): Promise<string | null> {
  if (!config.imagesEnabled) return null;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const prompt = `A single, tasteful encyclopedia illustration representing "${title}". Editorial, archival, painterly, museum plate quality, muted natural palette. No text, no words, no captions, no watermark, no borders.`;

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
