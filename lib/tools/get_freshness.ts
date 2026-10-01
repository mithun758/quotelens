import { z } from "zod";
import { addDays, daysBetween, isIsoDate } from "@/lib/normalise/dates";
import { defineTool } from "./define";

export const getFreshness = defineTool({
  name: "get_freshness",
  description:
    "Quote Freshness per supplier: Fresh, Reconfirm or Stale, with every fired rule, its severity, the numbers behind it and the recommended action. Use for 'is this quote still safe to act on' and 'at risk before approval'.",
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
        })),
    };
  },
});
