import { z } from "zod";
import { counts } from "@/lib/comparison/build";
import { defineTool } from "./define";
import { Basis, SupplierFilter, applySupplierFilter } from "./filters";

export const filterSuppliers = defineTool({
  name: "filter_suppliers",
  description:
    "Which suppliers match criteria: questionnaire pass, Quote Freshness status, coverage, incumbent. Returns each supplier's attributes and the included and excluded suppliers with reasons.",
  input: z.object({ filter: SupplierFilter.optional(), min_coverage: z.number().int().optional().describe("Minimum countable lines out of 30") }),
  output: z.object({
    basis: Basis,
    suppliers: z.array(
      z.object({
        supplier: z.string(),
        name: z.string(),
        incumbent: z.boolean(),
        questionnaire_passed: z.number(),
        questionnaire_total: z.number(),
        qualified: z.boolean(),
        failed_questions: z.array(z.string()),
        freshness: z.string().nullable(),
        coverage: z.number(),
        included: z.boolean(),
      }),
    ),
  }),
  run({ data }, input) {
    const basis = applySupplierFilter(data, input.filter);
    const coverage = (code: string) =>
      data.lines.filter((l) => {
        const c = data.cells[code]?.[l.line_no];
        return counts(c ? { value: c.normalised_value_inr, confidence: c.confidence_state, isSubstitute: c.substitute_status !== null, substituteStatus: c.substitute_status } : undefined);
      }).length;
    if (input.min_coverage !== undefined) {
      for (const code of [...basis.included_suppliers]) {
        if (coverage(code) < input.min_coverage) {
          basis.included_suppliers = basis.included_suppliers.filter((c) => c !== code);
          basis.excluded_suppliers.push({ supplier: code, reason: `coverage ${coverage(code)} below ${input.min_coverage}` });
        }
      }
    }
    return {
      basis,
      suppliers: data.suppliers.map((s) => ({
        supplier: s.code,
        name: s.name,
        incumbent: s.isIncumbent,
        questionnaire_passed: s.questionnairePassed,
        questionnaire_total: s.questionnaireTotal,
        qualified: s.questionnairePassed === s.questionnaireTotal,
        failed_questions: s.questionnaireFailures.map((f) => `${f.key}: ${f.answer ?? "not answered"}`),
        freshness: s.freshness?.status ?? null,
        coverage: coverage(s.code),
        included: basis.included_suppliers.includes(s.code),
      })),
    };
  },
});
