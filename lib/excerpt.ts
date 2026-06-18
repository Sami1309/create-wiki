// Turn article markdown into a short plain-text snippet for card previews.
export function excerpt(content: string, max = 150): string {
  let t = content
    // [[Title|display]] / [[Title]] -> display/title text
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, a, b) => b || a)
    // images ![alt](url) -> nothing
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // links [text](url) -> text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // headings / emphasis / quotes / list bullets
    .replace(/[#*_`>]/g, " ")
    .replace(/^\s*[-+]\s+/gm, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (t.length > max) {
    t = t.slice(0, max).replace(/\s+\S*$/, "") + "…";
  }
  return t;
}
