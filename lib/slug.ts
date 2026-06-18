// Title <-> slug helpers. The slug is the canonical key: two titles that slugify
// to the same value are treated as the same page (natural de-duplication).

export function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") // any run of non-alphanumerics -> single underscore
    .replace(/^_+|_+$/g, "") // trim leading/trailing underscores
    .slice(0, 200);
  return slug || "untitled";
}

// Best-effort reverse of slugify, for when a user lands on a URL we've never seen
// (e.g. they typed /wiki/quantum_banana directly). "quantum_banana" -> "Quantum Banana".
export function deslugify(slug: string): string {
  return slug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
