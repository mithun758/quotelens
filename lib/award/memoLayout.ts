// How the award memo is laid out, shared by the Award screen's preview and the PDF so
// the two match. Formatting only: the generated text is never changed. The "Quote
// Freshness" section is split into items so each can carry the stamp it names. Pure.

export type FreshnessStatus = "Fresh" | "Reconfirm" | "Stale";
export type FreshnessItem = { status: FreshnessStatus | null; text: string };
export type MemoLayout = { before: string; freshness: { heading: string; items: FreshnessItem[] } | null; after: string };

const HEADING = /^##\s+Quote Freshness\s*$/im;

// The first status word an item names, if any.
export function statusIn(text: string): FreshnessStatus | null {
  const m = text.match(/\b(Fresh|Reconfirm|Stale)\b/);
  return m ? (m[1] as FreshnessStatus) : null;
}

export function memoLayout(markdown: string): MemoLayout {
  const start = markdown.search(HEADING);
  if (start < 0) return { before: markdown, freshness: null, after: "" };
  const headingLine = markdown.slice(start).split("\n")[0];
  const rest = markdown.slice(start + headingLine.length);
  const next = rest.search(/^##\s+/m);
  const body = next < 0 ? rest : rest.slice(0, next);
  const after = next < 0 ? "" : rest.slice(next);
  // One item per list entry, or per paragraph when the section is prose.
  const items: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) items.push(current.join(" ").trim());
    current = [];
  };
  for (const line of body.split("\n")) {
    const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (item) {
      flush();
      current.push(item[1]);
    } else if (!line.trim()) flush();
    else current.push(line.trim());
  }
  flush();
  return {
    before: markdown.slice(0, start).trimEnd(),
    freshness: { heading: headingLine.replace(/^##\s+/, "").trim(), items: items.filter(Boolean).map((text) => ({ status: statusIn(text), text })) },
    after: after.trim(),
  };
}
