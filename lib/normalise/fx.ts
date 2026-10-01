import type { FxRateRow } from "@/lib/db/types";

// The rate on the date, or the latest earlier rate (weekends and holidays).
export function rateOn(rates: FxRateRow[], date: string): FxRateRow | null {
  let best: FxRateRow | null = null;
  for (const r of rates) {
    if (r.rate_date <= date && (!best || r.rate_date > best.rate_date)) best = r;
  }
  return best;
}
