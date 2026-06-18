import { slugify } from "@/lib/slug";

// Deadpan tech / SF-culture parody starting points. Plain <a> (not <Link>) so Next
// never prefetches them — prefetching a never-generated title would trigger
// generation before any click.
const PROMPTS = [
  "Premature Optimization (deity)",
  "Yak Shaving",
  "Bikeshedding",
  "Webscale",
  "Founder Mode",
  "The Tabs versus Spaces Schism",
  "Microservices (architectural movement)",
  "The Monorepo Wars",
  "Rubber Duck Debugging",
  "The Singularity (unincorporated community)",
  "Vibe Coding",
  "Conway's Law (jurisprudence)",
];

export function SamplePrompts() {
  return (
    <p className="suggestions">
      <span className="suggestions-label">Suggested articles:</span>
      {PROMPTS.map((p, i) => (
        <span key={p}>
          {i > 0 && <span className="suggestions-sep"> · </span>}
          <a
            className="suggestion"
            href={`/wiki/${slugify(p)}?t=${encodeURIComponent(p)}`}
          >
            {p}
          </a>
        </span>
      ))}
    </p>
  );
}
