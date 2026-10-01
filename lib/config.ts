// Business logic reads the as-of date from here, never from new Date().
const DEFAULT_AS_OF_DATE = "2026-09-30";

// The customer this prototype is configured for (fictional).
export const CUSTOMER_NAME = "Meridian Diagnostics";

export function asOfDate(): string {
  const value = process.env.AS_OF_DATE ?? DEFAULT_AS_OF_DATE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`AS_OF_DATE must be YYYY-MM-DD, got "${value}"`);
  }
  return value;
}

// Fixed table rather than Intl: newer ICU renders en-GB September as "Sept",
// which would make output vary between Node versions.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-09-30" -> "30 Sep 2026"
export function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}
