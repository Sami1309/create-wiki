// Central config, all overridable via environment variables.

function int(name: string, fallback: number): number {
  const v = parseInt(process.env[name] ?? "", 10);
  // Allow 0 as a valid "pause generation" value; only fall back on missing/invalid.
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export const config = {
  // Article text model (via OpenRouter). Opus 4.7 by default.
  textModel: process.env.OPENROUTER_MODEL ?? "anthropic/claude-opus-4.7",

  // Cheap/fast model for the planning pre-pass: article summary, relevant-link
  // selection, and image-prompt writing. Haiku by default.
  planModel: process.env.OPENROUTER_PLAN_MODEL ?? "anthropic/claude-haiku-4.5",

  // Image model (via OpenRouter). Grok Imagine by default.
  imageModel: process.env.OPENROUTER_IMAGE_MODEL ?? "x-ai/grok-imagine-image-quality",

  // Set IMAGES_ENABLED=false to skip image generation (saves cost).
  imagesEnabled: (process.env.IMAGES_ENABLED ?? "true").toLowerCase() !== "false",

  // Safeguards against runaway spend:
  // - how many articles may be generated at the same instant
  maxConcurrent: int("GEN_MAX_CONCURRENT", 2),
  // - hard ceiling on new articles per day
  maxPerDay: int("GEN_MAX_PER_DAY", 100),

  siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
};
