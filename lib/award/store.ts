// Persistence for the award: one per RFx. Every change writes an AuditEvent.
import type { Db } from "@/lib/db/client";
import { recordAuditEvent } from "@/lib/db/queries";
import type { AwardOverride, AwardRow, Json } from "@/lib/db/types";
import { AwardSpec, DEFAULT_SPEC, SCENARIO_LABEL } from "./spec";

export async function getAward(client: Db): Promise<{ award: AwardRow | null; spec: AwardSpec }> {
  const { data, error } = await client.from("award").select("*").order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(`load award: ${error.message}`);
  const award = data?.[0] ?? null;
  const parsed = AwardSpec.safeParse(award?.spec);
  return { award, spec: parsed.success ? parsed.data : DEFAULT_SPEC };
}

async function ensureAward(client: Db): Promise<AwardRow> {
  const { award } = await getAward(client);
  if (award) return award;
  const { data: rfx } = await client.from("rfx").select("id").single();
  if (!rfx) throw new Error("No RFx found");
  const { data, error } = await client.from("award").insert({ rfx_id: rfx.id, scenario: DEFAULT_SPEC.scenario, spec: DEFAULT_SPEC as unknown as Json }).select("*").single();
  if (error || !data) throw new Error(`create award: ${error?.message}`);
  return data;
}

// Changing the scenario or toggles invalidates any memo already written.
export async function saveSpec(client: Db, spec: AwardSpec): Promise<void> {
  const award = await ensureAward(client);
  const before = award.spec;
  const { error } = await client
    .from("award")
    .update({ scenario: spec.scenario, spec: spec as unknown as Json, memo_markdown: null, memo_warnings: [], memo_generated_at: null, status: "draft", updated_at: new Date().toISOString() })
    .eq("id", award.id);
  if (error) throw new Error(`save award: ${error.message}`);
  await recordAuditEvent({ actor: "priya", action: "choose_scenario", target: `award: ${SCENARIO_LABEL[spec.scenario]}`, before, after: spec as unknown as Json }, client);
}

export async function addOverride(client: Db, blocker: Omit<AwardOverride, "reason" | "at">, reason: string): Promise<void> {
  if (reason.trim().length < 10) throw new Error("Give a reason of at least a few words; it is printed in the memo.");
  const award = await ensureAward(client);
  const overrides = [...(award.overrides ?? []).filter((o) => o.key !== blocker.key), { ...blocker, reason: reason.trim(), at: new Date().toISOString() }];
  const { error } = await client.from("award").update({ overrides, memo_markdown: null, memo_generated_at: null, status: "draft", updated_at: new Date().toISOString() }).eq("id", award.id);
  if (error) throw new Error(`save override: ${error.message}`);
  await recordAuditEvent({ actor: "priya", action: "override_blocker", target: blocker.key, before: { detail: blocker.detail }, after: { overridden: true }, reason: reason.trim() }, client);
}

export async function removeOverride(client: Db, key: string): Promise<void> {
  const award = await ensureAward(client);
  const removed = (award.overrides ?? []).find((o) => o.key === key);
  if (!removed) return;
  await client.from("award").update({ overrides: award.overrides.filter((o) => o.key !== key), memo_markdown: null, memo_generated_at: null, status: "draft" }).eq("id", award.id);
  await recordAuditEvent({ actor: "priya", action: "withdraw_override", target: key, before: removed as unknown as Json }, client);
}

export async function saveMemo(client: Db, markdown: string, warnings: Json, totals: { total: number; vsL1: number; vsLastCycle: number; allocations: Json }): Promise<void> {
  const award = await ensureAward(client);
  const { error } = await client
    .from("award")
    .update({
      memo_markdown: markdown,
      memo_warnings: warnings,
      memo_generated_at: new Date().toISOString(),
      status: "ready",
      total_inr: totals.total,
      savings_vs_l1: totals.vsL1,
      savings_vs_last_cycle: totals.vsLastCycle,
      allocations: totals.allocations,
      updated_at: new Date().toISOString(),
    })
    .eq("id", award.id);
  if (error) throw new Error(`save memo: ${error.message}`);
  await recordAuditEvent({ actor: "model", action: "generate_award_memo", target: `award: ${SCENARIO_LABEL[award.scenario]}`, after: { total_inr: totals.total, warnings } as unknown as Json }, client);
}
