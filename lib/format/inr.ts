// INR with Indian grouping (₹1,05,000), and lakh or crore for totals.
export function formatInr(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return "";
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 2) })}`;
}

export function formatInrCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} crore`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} lakh`;
  return `${sign}${formatInr(abs)}`;
}

// A signed difference in words, so no reader has to interpret a minus sign:
// describeDelta(-132000, "last cycle") -> "₹1.32 lakh more than last cycle".
// A positive amount is a saving (cheaper than the reference).
export function describeDelta(saving: number, reference: string): string {
  if (Math.abs(saving) < 0.5) return `the same as ${reference}`;
  return `${formatInrCompact(Math.abs(saving))} ${saving > 0 ? "less" : "more"} than ${reference}`;
}
