// Number post-check: every number in the analyst's answer must appear in a tool result.
// Matching respects the precision the answer used ("93.52 lakh" matches 93,51,720) and
// lakh or crore scaling. Unmatched numbers come back as warnings, never silently dropped.

export type NumberToken = { text: string; value: number; tolerance: number; percent: boolean };
export type PostCheckWarning = { text: string; where: string; reason: string };

// Digits inside words ("L1", "Cat6", "14th", "1TB", "Wi-Fi 6E") are labels, not quantities.
const TOKEN = /(?:₹|Rs\.?\s?|USD\s?|\$)?\s?(-|−)?(?<![A-Za-z0-9.])(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?![A-Za-z0-9])\s?(%|lakhs?\b|crores?\b|cr\b|L\b)?/gi;

export function extractNumbers(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const digits = m[2];
    const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
    const unit = (m[3] ?? "").toLowerCase();
    const scale = unit.startsWith("lakh") || unit === "l" ? 1e5 : unit.startsWith("crore") || unit === "cr" ? 1e7 : 1;
    const value = Number(digits.replace(/,/g, "")) * scale;
    if (!Number.isFinite(value)) continue;
    out.push({ text: m[0].trim(), value, tolerance: 0.5 * 10 ** -decimals * scale, percent: unit === "%" });
  }
  return out;
}

// Every number a tool returned, including numbers inside strings and the length of
// every array (so "9 lines" matches a list of nine).
export function collectNumbers(value: unknown, pool: number[] = []): number[] {
  if (typeof value === "number") pool.push(value);
  else if (typeof value === "string") for (const t of extractNumbers(value)) pool.push(t.value);
  else if (Array.isArray(value)) {
    pool.push(value.length);
    for (const v of value) collectNumbers(v, pool);
  } else if (value && typeof value === "object") {
    const entries = Object.values(value);
    pool.push(entries.length);
    for (const v of entries) collectNumbers(v, pool);
  }
  return pool;
}

export function matches(token: NumberToken, pool: number[]): boolean {
  const target = Math.abs(token.value);
  return pool.some((v) => Math.abs(Math.abs(v) - target) <= token.tolerance + 1e-9);
}

// Links are not claims: drop URLs (bare or inside markdown links) before checking.
const URL = /https?:\/\/\S+/g;

// Numbered-list markers ("2. Line 1") are structure, not figures.
const LIST_MARKER = /^(\s*)\d+\.\s/gm;

export function postCheck(answer: string, pool: number[], where = "answer"): PostCheckWarning[] {
  return extractNumbers(answer.replace(URL, "").replace(LIST_MARKER, "$1"))
    .filter((t) => !matches(t, pool))
    .map((t) => ({ text: t.text, where, reason: "Not found in any tool result" }));
}
