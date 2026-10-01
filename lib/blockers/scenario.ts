// Blockers for an award: what must be resolved (or overridden with a typed reason)
// before the memo can go to Meera. Gating per the source of truth: any awarded line on
// an Inferred value or an open flag, any Stale supplier used, plus open clarifications,
// questionnaire failures of awarded suppliers and lines left unallocated.
// Keys are stable (never extracted-value ids), so overrides survive re-extraction.
import type { ScenarioResult } from "@/lib/scenarios/compute";
import type { AnalystData } from "@/lib/tools/data";

export type BlockerType = "inferred_value" | "open_flag" | "stale_supplier" | "awaiting_clarification" | "questionnaire_failure" | "unallocated_line";

export type Blocker = {
  key: string;
  type: BlockerType;
  supplier: string | null;
  line: number | null;
  detail: string;
  resolveBy: string;
  // How it can be resolved inline: accept the value, resolve the flag, or neither.
  resolve: { kind: "accept_value"; valueId: string } | { kind: "resolve_flag"; flagId: string } | { kind: "none" };
};

export function scenarioBlockers(data: AnalystData, scenario: ScenarioResult | null): Blocker[] {
  const lineScope = (supplier: string, line: number) => !scenario || scenario.allocation.some((a) => a.supplier === supplier && a.line === line);
  const suppliers = scenario ? scenario.by_supplier.map((b) => b.supplier) : data.suppliers.map((s) => s.code);
  const out: Blocker[] = [];

  for (const s of suppliers) {
    const info = data.suppliers.find((x) => x.code === s)!;
    for (const [lineNo, c] of Object.entries(data.cells[s] ?? {})) {
      const line = Number(lineNo);
      if (!lineScope(s, line)) continue;
      if (c.confidence_state === "inferred" && c.status === "needs_review") {
        out.push({
          key: `inferred_value:${s}:${line}`,
          type: "inferred_value",
          supplier: s,
          line,
          detail: c.reason ?? "Inferred value",
          resolveBy: "Accept or correct it in the review queue, or ask the supplier",
          resolve: { kind: "accept_value", valueId: c.id },
        });
      }
      for (const f of c.openFlags) {
        out.push({ key: `open_flag:${s}:${line}:${f.type}`, type: "open_flag", supplier: s, line, detail: f.message, resolveBy: "Resolve the flag", resolve: { kind: "resolve_flag", flagId: f.id } });
      }
    }
    for (const f of info.responseFlags.filter((x) => x.status === "open" && x.type !== "clarification_requested")) {
      out.push({ key: `open_flag:${s}::${f.type}`, type: "open_flag", supplier: s, line: null, detail: f.message, resolveBy: "Acknowledge or resolve it", resolve: { kind: "resolve_flag", flagId: f.id } });
    }
    if (info.freshness?.status === "Stale") {
      const high = info.freshness.fired.filter((r) => r.severity === "high");
      out.push({ key: `stale_supplier:${s}`, type: "stale_supplier", supplier: s, line: null, detail: high.map((r) => r.reason).join(" "), resolveBy: high.map((r) => r.action).join("; "), resolve: { kind: "none" } });
    }
    if (info.questionnairePassed < info.questionnaireTotal) {
      out.push({
        key: `questionnaire_failure:${s}`,
        type: "questionnaire_failure",
        supplier: s,
        line: null,
        detail: `Fails ${info.questionnaireTotal - info.questionnairePassed} of ${info.questionnaireTotal} questionnaire questions`,
        resolveBy: "Ask the supplier for the missing answers or evidence",
        resolve: { kind: "none" },
      });
    }
    for (const c of data.clarifications.filter((x) => x.supplierCode === s && x.status === "awaiting" && (x.lineNo === null || lineScope(s, x.lineNo)))) {
      out.push({
        key: `awaiting_clarification:${s}:${c.lineNo ?? ""}:${c.target_flag_type ?? c.field ?? ""}`,
        type: "awaiting_clarification",
        supplier: s,
        line: c.lineNo,
        detail: `Awaiting supplier reply: ${(c.subject ?? c.question).slice(0, 160)}`,
        resolveBy: "Wait for the reply, then review it in Quotes",
        resolve: { kind: "none" },
      });
    }
  }
  for (const u of scenario?.unallocated ?? []) {
    out.push({ key: `unallocated_line:${u.line}`, type: "unallocated_line", supplier: null, line: u.line, detail: `${u.description}: ${u.reason}`, resolveBy: "Choose a supplier for the line, or record why it is not being bought", resolve: { kind: "none" } });
  }
  return out;
}
