// Every Lens tool, as one registry: read tools, RFx drafting tools and action tools.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { acceptValuesTool, chooseScenarioTool, sendClarificationTool, setViewTool } from "./actions";
import { compareLastCycle } from "./compare_last_cycle";
import { compareScenarios } from "./compare_scenarios";
import { computeScenarioTool } from "./compute_scenario";
import type { AnalystTool, ToolContext } from "./define";
import { draftClarificationTool } from "./draft_clarification";
import { getMeridianStandards, getPurchaseHistory, getSuppliers, updateRfxDraft } from "./drafting";
import { exportTool } from "./export";
import { filterSuppliers } from "./filter_suppliers";
import { getComparison } from "./get_comparison";
import { getFreshness } from "./get_freshness";
import { getSource } from "./get_source";
import { listBlockers } from "./list_blockers";
import { makeChart } from "./make_chart";
import { rankLines } from "./rank_lines";
import { supplierTotals } from "./supplier_totals";

export const ANALYST_TOOLS: AnalystTool[] = [
  getComparison,
  filterSuppliers,
  rankLines,
  supplierTotals,
  computeScenarioTool,
  compareScenarios,
  compareLastCycle,
  getFreshness,
  listBlockers,
  getSource,
  draftClarificationTool,
  makeChart,
  exportTool,
  acceptValuesTool,
  sendClarificationTool,
  setViewTool,
  chooseScenarioTool,
  getPurchaseHistory,
  getMeridianStandards,
  getSuppliers,
  updateRfxDraft,
] as AnalystTool[];

export function anthropicToolDefinitions(): Anthropic.Beta.BetaTool[] {
  return ANALYST_TOOLS.map((t) => {
    const schema = { ...(z.toJSONSchema(t.input) as Record<string, unknown>) };
    delete schema.$schema;
    return { name: t.name, description: t.description, input_schema: schema as Anthropic.Beta.BetaTool.InputSchema };
  });
}

export type ToolRun = { name: string; input: unknown; output: unknown; error: string | null; modelSuppliedNumbers: boolean; action?: boolean };

// Validates the model's input, runs the tool, and validates the output against its schema.
export async function runTool(ctx: ToolContext, name: string, rawInput: unknown): Promise<ToolRun> {
  const tool = ANALYST_TOOLS.find((t) => t.name === name);
  if (!tool) return { name, input: rawInput, output: null, error: `Unknown tool ${name}`, modelSuppliedNumbers: false };
  const parsed = tool.input.safeParse(rawInput);
  if (!parsed.success) return { name, input: rawInput, output: null, error: `Invalid input: ${z.prettifyError(parsed.error)}`, modelSuppliedNumbers: !!tool.modelSuppliedNumbers };
  try {
    const output = tool.output.parse(await tool.run(ctx, parsed.data));
    return { name, input: parsed.data, output, error: null, modelSuppliedNumbers: !!tool.modelSuppliedNumbers, action: !!tool.action };
  } catch (error) {
    return { name, input: parsed.data, output: null, error: error instanceof Error ? error.message : String(error), modelSuppliedNumbers: !!tool.modelSuppliedNumbers };
  }
}
