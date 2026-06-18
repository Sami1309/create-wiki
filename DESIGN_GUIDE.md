# Create-Wiki — Design Guide

The guiding idea: **it should feel like Wikipedia, not like a showcase.** The product is
an encyclopedia. Encyclopedias are useful, plain, and self-effacing. Every design and
writing decision should reduce ornament and increase the feeling that this is a real,
boring, trustworthy reference work — which is exactly what makes the AI-generated content
funny and interesting.

---

## 1. Core principles

1. **Restraint over flourish.** No decorative textures, drop caps, custom display fonts,
   grain overlays, or theatrical motion. If an element doesn't aid reading or navigation,
   remove it.
2. **Wikipedia is the reference.** When unsure how something should look or read, ask
   "what would Wikipedia do?" and do that.
3. **Deadpan, not whimsical.** The humor comes from treating absurd things with total
   seriousness — never from playful wording, winking, or showing off.
4. **The content is the interface.** Chrome is minimal and gets out of the way of the
   article text.
5. **Fast to read, fast to scan.** Clear hierarchy, generous line-height, short line
   lengths (~800px article column).

---

## 2. Visual language

### Color (the Wikipedia palette)
Defined as CSS variables in `app/globals.css`.

| Token | Value | Use |
|---|---|---|
| `--text` | `#202122` | Body text |
| `--muted` / `--muted-2` | `#54595d` / `#72777d` | Secondary text, captions, meta |
| `--link` / `--link-hover` | `#3366cc` / `#2a4b8d` | Links |
| `--border` / `--border-light` | `#a2a9b1` / `#c8ccd1` | Box borders, thumbnails |
| `--separator` | `#eaecf0` | Hairline rules between rows |
| `--bg` / `--bg-soft` / `--bg-header` | `#fff` / `#f8f9fa` / `#eaecf0` | Page, soft panels, panel headers |

White background everywhere. No gradients. No shadows beyond what a thin border provides.

### Typography
- **Body & UI:** system sans stack (`--sans`) — `-apple-system, "Segoe UI", Roboto,
  Helvetica, Arial, sans-serif`.
- **Headings (site title, article `h1`/`h2`/`h3`, panel titles):** serif stack
  (`--serif`) — `"Linux Libertine", Georgia, "Times New Roman", serif`. Serif headings are
  the single most recognizable Wikipedia cue.
- Headings are **regular weight (400)**, not bold/black. Size creates hierarchy, not weight.
- `h1` and `h2` carry a thin bottom border, like Wikipedia section headings.

### Links
- Blue (`--link`), **no underline by default, underline on hover.** Don't color links any
  other way; don't add icons.

### Spacing & layout
- Home column: `--content` (880px). Article column: `--article` (800px).
- Article images are **infoboxes**: small (≤280px), floated top-right, thin border, light
  background, small gray caption. They stack full-width under ~600px. The image prompt is
  generated from the article's summary (`writeImagePrompt` in `lib/generate.ts`) so the
  picture matches the article, and is told to look documentary/neutral — a Wikipedia-style
  photo, diagram, or schematic — never artistic or whimsical, and never with text.
- Motion budget: essentially zero, with one exception — **functional progress indicators
  during generation**. Because articles stream in live, the generating state may use a subtle
  text skeleton, a shimmer/spinner image placeholder, and a blinking "typing" caret at the end
  of the streamed text. These are loading affordances, not decoration; once the article is
  saved it serves statically with no motion at all.

### Don'ts
- ❌ Decorative fonts, grain/paper textures, drop caps, sepia image filters.
- ❌ Card hover lifts, staggered reveals, big hero images.
- ❌ Emoji/ornament glyphs in UI chrome (no ❦, no "⟵ The Almanac").
- ❌ Purple-on-white "AI" gradients of any kind.

---

## 3. Voice & content

The article-generation prompt lives in `lib/generate.ts` (`SYSTEM_PROMPT`). Its principles:

- **Register:** strictly neutral, factual, encyclopedic — like a real Wikipedia article.
  Lead sentence defines the subject. Sections like History, Overview, Design,
  Implementation, Adoption, Reception, Criticism, Legacy.
- **Subject matter:** lean toward **software, computing, startups, the internet, and
  science-fiction/tech culture** — the in-jokes and phenomena that tech/SF people find
  funny or interesting (e.g. _Webscale_, _Yak Shaving_, _Founder Mode_, _The Monorepo
  Wars_). Treat jargon, tools, rituals, and trends as if they were genuinely notable.
- **Humor:** deadpan only. Achieved by describing absurd things seriously, never by jokey
  phrasing. If a sentence sounds like it's trying to be clever, it's wrong.
- **No showing off.** Avoid ornate vocabulary, dramatic narration, and "look how creative
  this is" energy.
- **Links:** weave `[[Wiki Links]]` naturally; invent 3–6 new tech-adjacent related topics
  per article to keep the graph growing.

### Microcopy
Plain and functional. "Search", "Random articles", "Most read", "Generating this
article…", "Daily limit reached". Never "Conjure", "summon", "almanac", "scriptorium".

A standard italic **hatnote** sits under every article title:
> _This article was generated by AI and may be inaccurate or entirely fictional._

---

## 4. Quick checklist for any new UI

- [ ] White background, thin gray borders, serif headings, sans body, blue links.
- [ ] No new fonts, textures, shadows, or animations without a functional reason.
- [ ] Microcopy is plain and Wikipedia-like.
- [ ] If it generates text, it routes through the `SYSTEM_PROMPT` voice (dry, deadpan, tech).
- [ ] It reads like a reference work, not a portfolio piece.
