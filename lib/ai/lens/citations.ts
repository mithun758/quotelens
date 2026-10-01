// Lens citations: [[cell:<supplier>:<line>]] points at a Quote Comparison cell and
// [[doc:<document_id>:<locator>]] at a place in a source document. Pure, so the server
// can validate them and the UI can render them with the same rules.
import type { SourceLocator } from "@/lib/db/types";
import { extractNumbers } from "../postcheck";

export const CELL_CITE = /\[\[cell:([A-Z]):(\d{1,3})\]\]/g;
export const DOC_CITE = /\[\[doc:([0-9a-f-]{36}):([^\]]*)\]\]/g;

// A locator as compact key=value pairs: page=1;bbox=0.1,0.2,0.3,0.4 or sheet=Summary;cell=B12.
export function encodeLocator(loc: SourceLocator | null | undefined): string {
  if (!loc) return "";
  const parts: string[] = [];
  for (const k of ["page", "sheet", "cell", "paragraph", "line"] as const) if (loc[k] !== undefined && loc[k] !== null) parts.push(`${k}=${encodeURIComponent(String(loc[k]))}`);
  if (Array.isArray(loc.bbox) && loc.bbox.length === 4) parts.push(`bbox=${loc.bbox.join(",")}`);
  return parts.join(";");
}

export function decodeLocator(text: string): SourceLocator {
  const out: Record<string, unknown> = {};
  for (const part of text.split(";")) {
    const [k, v] = part.split("=");
    if (!k || v === undefined) continue;
    const value = decodeURIComponent(v);
    if (k === "bbox") out.bbox = value.split(",").map(Number);
    else if (k === "page" || k === "paragraph" || k === "line") out[k] = Number(value);
    else if (k === "sheet" || k === "cell") out[k] = value;
  }
  return out as SourceLocator;
}

export const docCite = (documentId: string, loc: SourceLocator | null | undefined) => `[[doc:${documentId}:${encodeLocator(loc)}]]`;

export type CitationCheck = { text: string; warnings: { text: string; where: string; reason: string }[] };

// The text a citation belongs to: back to the start of its sentence, table cell or line.
function clauseBefore(text: string, index: number): string {
  const before = text.slice(Math.max(0, index - 160), index);
  // Sentence punctuation counts only when a space follows, so "55.18" stays whole.
  let cut = -1;
  for (const m of before.matchAll(/[.;:!?](?=\s)|\||\n/g)) cut = m.index!;
  return cut >= 0 ? before.slice(cut + 1) : before;
}

// Drops citations that point at nothing, or at a cell whose value is not the figure
// beside it (a basket total cited to one line), and says so.
export function checkCitations(
  text: string,
  cellExists: (supplier: string, line: number) => boolean,
  docExists: (id: string) => boolean,
  cellValue: (supplier: string, line: number) => number | null = () => null,
): CitationCheck {
  const warnings: CitationCheck["warnings"] = [];
  let out = text.replace(CELL_CITE, (m, s: string, n: string, offset: number) => {
    if (!cellExists(s, Number(n))) {
      warnings.push({ text: m, where: "answer", reason: "Cites a comparison cell that does not exist; removed" });
      return "";
    }
    const value = cellValue(s, Number(n));
    const figures = extractNumbers(clauseBefore(text, offset)).filter((t) => !t.percent && t.value >= 10);
    if (value !== null && figures.length && !figures.some((t) => Math.abs(t.value - value) <= t.tolerance + 1e-9)) {
      warnings.push({ text: m, where: "answer", reason: `Cites ${s} line ${n}, whose value is not the figure beside it; removed` });
      return "";
    }
    return m;
  });
  out = out.replace(DOC_CITE, (m, id: string) => {
    if (docExists(id)) return m;
    warnings.push({ text: m, where: "answer", reason: "Cites a document that does not exist; removed" });
    return "";
  });
  return { text: out, warnings };
}

// Citations are references, not figures: removed before the number post-check.
export const stripCitations = (text: string) => text.replace(CELL_CITE, "").replace(DOC_CITE, "");
