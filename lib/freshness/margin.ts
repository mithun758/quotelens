import { addDays, daysBetween, isIsoDate } from "@/lib/normalise/dates";

// Days a quote stays valid after approval completes (as-of date plus approval days).
// Negative when it lapses first; null when no validity is stated. The same dates the
// validity rule uses.
export function daysAfterApproval(validUntil: string | null | undefined, asOfDate: string, approvalDays: number): number | null {
  if (!isIsoDate(validUntil)) return null;
  return daysBetween(addDays(asOfDate, approvalDays), validUntil);
}
