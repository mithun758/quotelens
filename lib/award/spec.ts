// The award Priya is building: a scenario plus eligibility and freshness toggles.
import { z } from "zod";
import { SCENARIOS, type ScenarioSpec } from "@/lib/scenarios/compute";

export const AwardSpec = z.object({
  scenario: z.enum(SCENARIOS),
  // Eligibility defaults per the source of truth: questionnaire passed, substitutes approved.
  require_questionnaire: z.boolean(),
  require_substitute_approval: z.boolean(),
  exclude_stale: z.boolean(),
  exclude_reconfirm: z.boolean(),
  assignments: z.array(z.object({ supplier: z.string(), category: z.string().optional(), lines: z.array(z.number().int()).optional() })).optional(),
  default_supplier: z.string().optional(),
});
export type AwardSpec = z.infer<typeof AwardSpec>;

export const DEFAULT_SPEC: AwardSpec = {
  scenario: "best_quote",
  require_questionnaire: true,
  require_substitute_approval: true,
  exclude_stale: false,
  exclude_reconfirm: false,
};

export const SCENARIO_LABEL: Record<AwardSpec["scenario"], string> = {
  best_quote: "Best Quote",
  best_supplier: "Best Supplier",
  incumbent: "Incumbent",
  best_quote_without_incumbent: "Best Quote Without Incumbent",
  custom: "Custom",
};

export function toScenarioSpec(spec: AwardSpec, scenario: AwardSpec["scenario"] = spec.scenario): ScenarioSpec {
  const exclude: ("Stale" | "Reconfirm")[] = [];
  if (spec.exclude_stale) exclude.push("Stale");
  if (spec.exclude_reconfirm) exclude.push("Reconfirm");
  return {
    scenario,
    filter: { questionnaire_passed_only: spec.require_questionnaire, exclude_freshness: exclude },
    include_pending_substitutes: !spec.require_substitute_approval,
    assignments: scenario === "custom" ? spec.assignments : undefined,
    default_supplier: scenario === "custom" ? spec.default_supplier : undefined,
  };
}

export function describeEligibility(spec: AwardSpec): string[] {
  return [
    spec.require_questionnaire ? "Only suppliers that pass the quality questionnaire" : "Questionnaire not required",
    spec.require_substitute_approval ? "Substitutes count only once Arjun approves them" : "Substitutes awaiting Arjun's sign-off are allowed",
    spec.exclude_stale ? "Stale quotes excluded" : "Stale quotes allowed (they block the memo unless overridden)",
    spec.exclude_reconfirm ? "Quotes needing reconfirmation excluded" : "Quotes needing reconfirmation allowed",
  ];
}
