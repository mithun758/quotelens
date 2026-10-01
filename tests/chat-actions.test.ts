import fs from "node:fs";
import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { ANALYST_TOOLS, runTool } from "@/lib/tools";
import { dataFromGroundTruth } from "./helpers/groundTruthData";

// A stand-in Supabase client: every read resolves to nothing, every write is recorded.
function recordingClient() {
  const writes: string[] = [];
  const result = { data: [], error: null, count: 0 };
  const WRITES = new Set(["insert", "update", "upsert", "delete", "rpc", "upload", "remove"]);
  const chain: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
      if (typeof prop === "string" && WRITES.has(prop))
        return () => {
          writes.push(prop);
          return chain;
        };
      return chain;
    },
    apply: () => chain,
  });
  return { client: chain as Db, writes };
}

const ACTION_CALLS: [string, unknown][] = [
  ["accept_values", { supplier: "E", reason: "same_as_last_year" }],
  ["send_clarification", { supplier: "A", lines: [20, 21] }],
  ["set_view", { view: "prices", quotes: "decision_ready", basket: "all" }],
  ["choose_scenario_and_draft_memo", { scenario: "best_quote" }],
];

describe("chat actions", () => {
  it("are exactly the four action tools, and none of them overrides a blocker", () => {
    const actions = ANALYST_TOOLS.filter((t) => t.action).map((t) => t.name);
    expect(actions.sort()).toEqual(ACTION_CALLS.map(([n]) => n).sort());
    expect(ANALYST_TOOLS.some((t) => /override/i.test(t.name))).toBe(false);
  });

  it.each(ACTION_CALLS)("%s writes nothing before confirmation and returns a preview", async (name, input) => {
    const { client, writes } = recordingClient();
    const run = await runTool({ data: dataFromGroundTruth(), client }, name, input);
    expect(run.error).toBeNull();
    expect(writes).toEqual([]);
    const out = run.output as { kind: string; requires_confirmation?: boolean };
    if (name !== "set_view") expect(out.requires_confirmation).toBe(true);
  });

  it("accept_values lists each value with its reason, all from the chosen group", async () => {
    const { client } = recordingClient();
    const run = await runTool({ data: dataFromGroundTruth(), client }, "accept_values", { supplier: "E", reason: "same_as_last_year" });
    const out = run.output as { items: { key: string; reason: string | null }[] };
    expect(out.items.length).toBe(21);
    expect(out.items.every((i) => i.key.startsWith("value:") && i.reason?.startsWith("Supplier said same as last year"))).toBe(true);
  });

  it("choose_scenario blocks the memo while blockers remain", async () => {
    const { client } = recordingClient();
    const run = await runTool({ data: dataFromGroundTruth(), client }, "choose_scenario_and_draft_memo", { scenario: "best_quote" });
    const out = run.output as { memo_blocked: boolean; open_blockers: unknown[] };
    expect(out.memo_blocked).toBe(out.open_blockers.length > 0);
  });

  it("the system prompt forbids acting without a confirmed preview and sends overrides to the Award screen", () => {
    const prompt = fs.readFileSync("lib/ai/analyst.ts", "utf8");
    expect(prompt).toMatch(/never perform an action without a preview that Priya confirms/);
    expect(prompt).toMatch(/You cannot override blockers/);
  });
});
