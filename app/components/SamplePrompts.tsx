import { slugify } from "@/lib/slug";

// Curated starting points. Plain <a> (not <Link>) so Next never prefetches them —
// prefetching a never-generated title would trigger generation before any click.
const PROMPTS = [
  "The Glass Symphony of 1847",
  "Cartography of Forgotten Dreams",
  "The Last Lighthouse on Mars",
  "Theory of Edible Architecture",
  "The Midnight Parliament of Cats",
  "Hydraulic Memory Engines",
  "The Untranslatable City",
  "Saint Vivenna of the Tides",
  "The Great Vowel Rebellion of 1623",
  "Subterranean Weather Gardens",
  "The Cartographers' Guild of Nowhere",
  "Bioluminescent Cathedral Moss",
];

export function SamplePrompts() {
  return (
    <div className="prompts">
      <span className="prompts-label">or summon one of these</span>
      <div className="prompt-row">
        {PROMPTS.map((p) => (
          <a
            key={p}
            className="prompt-chip"
            href={`/wiki/${slugify(p)}?t=${encodeURIComponent(p)}`}
          >
            {p}
          </a>
        ))}
      </div>
    </div>
  );
}
