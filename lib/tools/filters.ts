// Shared supplier and line selection for analyst tools. Every tool that applies a
// filter returns its basis: who was included and who was excluded, and why.
import { z } from "zod";
import type { AnalystData } from "./data";

export const SupplierFilter = z
  .object({
    suppliers: z.array(z.string()).optional().describe("Only these supplier codes, e.g. [\"A\", \"B\"]. Omit for all."),
    exclude_suppliers: z.array(z.string()).optional().describe("Supplier codes to leave out"),
    questionnaire_passed_only: z.boolean().optional().describe("Only suppliers that pass every questionnaire question (qualified)"),
    exclude_freshness: z
      .array(z.enum(["Stale", "Reconfirm"]))
      .optional()
      .describe('Leave out suppliers with these Quote Freshness statuses. "Quotes that need reconfirmation" means ["Stale", "Reconfirm"]; "excluding stale quotes" means ["Stale"]'),
    exclude_incumbent: z.boolean().optional(),
  })
  .describe("Which suppliers to consider");
export type SupplierFilter = z.infer<typeof SupplierFilter>;

export const LineFilter = z.object({
  lines: z.array(z.number().int()).optional().describe("Only these RFx line numbers"),
  category: z.string().optional().describe("Only lines in this category, e.g. Networking, Computing, Displays, Accessories, Printing and scanning, Power, Storage"),
});
export type LineFilter = z.infer<typeof LineFilter>;

export const Basis = z.object({
  included_suppliers: z.array(z.string()),
  excluded_suppliers: z.array(z.object({ supplier: z.string(), reason: z.string() })),
});
export type Basis = z.infer<typeof Basis>;

export function applySupplierFilter(data: AnalystData, f: SupplierFilter = {}): Basis {
  const excluded: Basis["excluded_suppliers"] = [];
  const included: string[] = [];
  const known = new Set(data.suppliers.map((s) => s.code));
  for (const code of [...(f.suppliers ?? []), ...(f.exclude_suppliers ?? [])]) {
    if (!known.has(code.toUpperCase())) throw new Error(`Unknown supplier code ${code}. Known: ${[...known].join(", ")}`);
  }
  for (const s of data.suppliers) {
    const reasons: string[] = [];
    if (f.suppliers?.length && !f.suppliers.map((c) => c.toUpperCase()).includes(s.code)) reasons.push("not in the requested set");
    if (f.exclude_suppliers?.map((c) => c.toUpperCase()).includes(s.code)) reasons.push("excluded on request");
    if (f.questionnaire_passed_only && s.questionnairePassed < s.questionnaireTotal) reasons.push(`fails the questionnaire (${s.questionnairePassed}/${s.questionnaireTotal} passed)`);
    if (s.freshness && f.exclude_freshness?.includes(s.freshness.status as "Stale" | "Reconfirm")) {
      reasons.push(`Quote Freshness ${s.freshness.status}: ${s.freshness.fired.map((r) => r.label).join(", ")}`);
    }
    if (f.exclude_incumbent && s.isIncumbent) reasons.push("incumbent excluded");
    if (reasons.length) excluded.push({ supplier: s.code, reason: reasons.join("; ") });
    else included.push(s.code);
  }
  return { included_suppliers: included, excluded_suppliers: excluded };
}

export function selectLines(data: AnalystData, f: LineFilter = {}) {
  const categories = [...new Set(data.lines.map((l) => l.category))];
  if (f.category && !categories.some((c) => c.toLowerCase() === f.category!.toLowerCase())) {
    throw new Error(`Unknown category ${f.category}. Known: ${categories.join(", ")}`);
  }
  return data.lines.filter(
    (l) => (!f.lines?.length || f.lines.includes(l.line_no)) && (!f.category || l.category.toLowerCase() === f.category.toLowerCase()),
  );
}
