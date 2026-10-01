import type { ConfidenceState, SourceLocator } from "@/lib/db/types";

export const inr = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function displayDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export const CONFIDENCE_STYLE: Record<ConfidenceState, string> = {
  extracted: "bg-zinc-100 text-zinc-700",
  inferred: "bg-amber-100 text-amber-900",
  missing: "bg-red-100 text-red-800",
};

export const CONFIDENCE_LABEL: Record<ConfidenceState, string> = {
  extracted: "Extracted",
  inferred: "Inferred",
  missing: "Missing",
};

export function locatorLabel(loc: SourceLocator | null | undefined): string {
  if (!loc) return "";
  if (loc.sheet || loc.cell) return [loc.sheet, loc.cell].filter(Boolean).join("!");
  if (loc.paragraph) return `paragraph ${loc.paragraph}`;
  if (loc.line) return `line ${loc.line}`;
  if (loc.page) return `page ${loc.page}`;
  return "";
}
