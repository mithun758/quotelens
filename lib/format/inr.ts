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
