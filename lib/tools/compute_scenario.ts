import { z } from "zod";
import { SCENARIOS, computeScenario } from "@/lib/scenarios/compute";
import { defineTool } from "./define";
import { Basis, SupplierFilter } from "./filters";

export const ScenarioInput = z.object({
  scenario: z
    .enum(SCENARIOS)
    .describe(
      "best_quote: lowest price per line (split award); best_supplier: single award to the supplier with most lines, then lowest common-basket total; incumbent: everything to the incumbent; best_quote_without_incumbent; custom: allocations you give",
    ),
  filter: SupplierFilter.optional(),
  assignments: z
    .array(z.object({ supplier: z.string(), lines: z.array(z.number().int()).optional(), category: z.string().optional() }))
    .optional()
    .describe('For custom: e.g. [{"supplier": "C", "category": "Networking"}]'),
  default_supplier: z.string().optional().describe('For custom: supplier for every line not assigned, e.g. "the rest to B"'),
  apply_conditional_discounts: z.boolean().optional().describe("Default true: apply a supplier's conditional discount when its awarded subtotal meets the condition"),
  include_pending_substitutes: z.boolean().optional().describe("Default false: substitutes awaiting Arjun's sign-off are not awarded"),
});

export const computeScenarioTool = defineTool({
  name: "compute_scenario",
  description:
    "Computes an award scenario: allocation per line, totals per supplier, conditional discounts, total, saving against last cycle, premium over the nominal L1 across all suppliers, and which lines rest on Inferred or prior-pricing values or Stale suppliers.",
  input: ScenarioInput,
  output: z.object({
    scenario: z.string(),
    basis: Basis,
    allocation: z.array(
      z.object({
        line: z.number(),
        description: z.string(),
        supplier: z.string(),
        unit_inr: z.number(),
        quantity: z.number(),
        total_inr: z.number(),
        confidence: z.string(),
        on_prior_pricing: z.boolean(),
        last_cycle_unit_inr: z.number().nullable(),
        nominal_l1_supplier: z.string().nullable(),
        nominal_l1_unit_inr: z.number().nullable(),
      }),
    ),
    unallocated: z.array(z.object({ line: z.number(), description: z.string(), reason: z.string() })),
    by_supplier: z.array(z.object({ supplier: z.string(), lines: z.array(z.number()), subtotal_inr: z.number(), discount_inr: z.number(), total_inr: z.number(), freshness: z.string().nullable() })),
    discounts: z.array(z.object({ supplier: z.string(), percent: z.number(), condition: z.string().nullable(), applied: z.boolean(), reason: z.string(), amount_inr: z.number() })),
    total_inr: z.number(),
    total_display: z.string(),
    total_exact_display: z.string().describe("Exact total with Indian grouping, for when the exact figure is wanted"),
    last_cycle_inr: z.number(),
    last_cycle_display: z.string(),
    saving_vs_last_cycle_inr: z.number(),
    saving_vs_last_cycle_display: z.string().describe("Negative means the award costs more than last cycle"),
    saving_vs_last_cycle_pct: z.number().nullable(),
    nominal_l1_inr: z.number(),
    nominal_l1_display: z.string(),
    premium_vs_nominal_l1_inr: z.number(),
    premium_vs_nominal_l1_display: z.string(),
    inferred_lines: z.array(z.number()),
    prior_pricing_lines: z.array(z.number()),
    stale_suppliers_used: z.array(z.string()),
    reconfirm_suppliers_used: z.array(z.string()),
  }),
  run({ data }, input) {
    return computeScenario(data, input);
  },
});
