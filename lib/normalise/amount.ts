// Parses a price exactly as printed ("₹72,650", "Rs. 1,120/pkt", "USD 1160.00",
// "2,040/-", "1,00,800.00") into a number. Returns null if there is no number.
export function parseAmount(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
