import { z } from "zod";
import { addDays, daysBetween, isIsoDate } from "@/lib/normalise/dates";
import { formatInrCompact } from "@/lib/format/inr";
import type { AnalystData } from "./data";
import { defineTool, round2 } from "./define";

// Rupee exposure on lines converted from a foreign currency: what those lines cost in
// INR at the rate used, and how much that moves per 1% change in the rate.
function fxExposure(data: AnalystData, supplier: string) {
  const qty = new Map(data.lines.map((l) => [l.line_no, l.quantity]));
  const lines = Object.values(data.cells[supplier] ?? {}).flatMap((c) => {
    const fx = c.steps.find((st) => st.kind === "fx");
    if (!fx || !fx.rate || c.normalised_value_inr === null || c.line_no === null) return [];
    const q = qty.get(c.line_no) ?? 0;
    return [{ line: c.line_no, currency: c.raw_currency ?? "", rate: fx.rate, rate_date: fx.rate_date, unit_inr: c.normalised_value_inr, line_inr: round2(c.normalised_value_inr * q), line_foreign: round2((c.normalised_value_inr / fx.rate) * q) }];
  });
  if (!lines.length) return null;
  const inr = round2(lines.reduce((t, l) => t + l.line_inr, 0));
  return {
    currencies: [...new Set(lines.map((l) => l.currency))],
    lines: lines.sort((a, b) => a.line - b.line),
    total_inr: inr,
    total_display: formatInrCompact(inr),
    total_foreign: round2(lines.reduce((t, l) => t + l.line_foreign, 0)),
    inr_change_per_1pct_rate_move: round2(inr / 100),
    inr_change_per_1pct_rate_move_display: formatInrCompact(round2(inr / 100)),
  };
}

export const getFreshness = defineTool({
  name: "get_freshness",
  description:
    "Quote Freshness per supplier: Fresh, Reconfirm or Stale, with every fired rule, its severity, the numbers behind it and the recommended action. Also the rupee FX exposure on lines quoted in a foreign currency. Use for 'is this quote still safe to act on', 'at risk before approval' and 'FX exposure'.",
  input: z.object({ suppliers: z.array(z.string()).optional().describe("Supplier codes; omit for all") }),
  output: z.object({
    as_of_date: z.string(),
    approval_days: z.number(),
    approval_completes: z.string(),
    suppliers: z.array(
      z.object({
        supplier: z.string(),
        status: z.string().nullable(),
        quote_date: z.string().nullable(),
        valid_until: z.string().nullable(),
        days_valid_after_approval: z.number().nullable().describe("Negative: the quote lapses this many days before approval completes"),
        fired_rules: z.array(z.object({ rule: z.string(), severity: z.string().nullable(), reason: z.string(), action: z.string(), lines: z.array(z.number()) })),
        fx_exposure: z
          .object({
            currencies: z.array(z.string()),
            lines: z.array(z.object({ line: z.number(), currency: z.string(), rate: z.number(), rate_date: z.string().nullable(), unit_inr: z.number(), line_inr: z.number(), line_foreign: z.number() })),
            total_inr: z.number(),
            total_display: z.string(),
            total_foreign: z.number().describe("In the quoted currency, ex-GST, before conversion"),
            inr_change_per_1pct_rate_move: z.number(),
            inr_change_per_1pct_rate_move_display: z.string(),
          })
          .nullable()
          .describe("Null when every line was quoted in INR. Covers only lines converted from a foreign currency"),
      }),
    ),
  }),
  run({ data }, input) {
    const wanted = input.suppliers?.map((s) => s.toUpperCase());
    const approvalCompletes = addDays(data.asOfDate, data.rfx.approval_days);
    return {
      as_of_date: data.asOfDate,
      approval_days: data.rfx.approval_days,
      approval_completes: approvalCompletes,
      suppliers: data.suppliers
        .filter((s) => !wanted?.length || wanted.includes(s.code))
        .map((s) => ({
          supplier: s.code,
          status: s.freshness?.status ?? null,
          quote_date: s.quoteDate,
          valid_until: s.validUntil,
          days_valid_after_approval: isIsoDate(s.validUntil) ? daysBetween(approvalCompletes, s.validUntil) : null,
          fired_rules: (s.freshness?.fired ?? []).map((r) => ({ rule: r.label, severity: r.severity, reason: r.reason, action: r.action, lines: r.lines })),
          fx_exposure: fxExposure(data, s.code),
        })),
    };
  },
});
