import type { NormalisationStepRow, SourceLocator } from "@/lib/db/types";

export const inr = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function displayDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function locatorLabel(loc: SourceLocator | null | undefined): string {
  if (!loc) return "";
  if (loc.sheet || loc.cell) return [loc.sheet, loc.cell].filter(Boolean).join("!");
  if (loc.paragraph) return `paragraph ${loc.paragraph}`;
  if (loc.line) return `line ${loc.line}`;
  if (loc.page) return `page ${loc.page}`;
  return "";
}

// One ledger line, e.g. "USD 740.00 × 84.6 (Illustrative rate, 30 Sep 2026) = ₹62,604".
export function stepText(s: NormalisationStepRow, currency: string | null): string {
  const date = s.rate_date ? `, ${displayDate(s.rate_date)}` : "";
  switch (s.kind) {
    case "fx":
      return `${currency ?? ""} ${Number(s.input).toFixed(2)} × ${s.rate} (${s.rate_source}${date}) = ${inr(s.output)}`;
    case "revision":
      return `${inr(s.input)} revised to ${inr(s.output)}. ${s.rate_source ?? ""}`.trim();
    case "bundle":
      return `${inr(s.input)} − ${inr(s.rate)} (${s.rate_source}) = ${inr(s.output)}`;
    default:
      return `${inr(s.input)} ÷ ${s.rate} (${s.rate_source}) = ${inr(s.output)}`;
  }
}


// The earlier price a later document revised, if any: shown struck through beside the new one.
export function revisionOf(steps: NormalisationStepRow[]): NormalisationStepRow | null {
  return [...steps].reverse().find((s) => s.kind === "revision") ?? null;
}
