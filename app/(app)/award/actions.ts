"use server";

import { overrideReasonProblem } from "@/lib/award/override";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { buildMemoFacts } from "@/lib/award/memo-facts";
import { negotiationLines } from "@/lib/award/negotiation";
import { AwardSpec } from "@/lib/award/spec";
import { addOverride, getAward, removeOverride, saveMemo, saveSpec } from "@/lib/award/store";
import { loadAwardView } from "@/lib/award/view";
import { writeAwardMemo } from "@/lib/ai/memo";
import { hasValidSession } from "@/lib/auth/gate";
import { asOfDate, formatDisplayDate } from "@/lib/config";
import { db } from "@/lib/db/client";
import { friendlyError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";
import { recordAuditEvent } from "@/lib/db/queries";
import type { Json } from "@/lib/db/types";
import { memoToPdf } from "@/lib/export/memoPdf";
import { documentToXlsx } from "@/lib/export/xlsx";
import { formatInr } from "@/lib/format/inr";
import { acceptItem } from "@/lib/review/decisions";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function guarded<T>(fn: () => Promise<T>): Promise<Result<T>> {
  if (!(await hasValidSession())) return { ok: false, error: "Passcode required" };
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function saveSpecAction(spec: AwardSpec) {
  return guarded(async () => saveSpec(db(), AwardSpec.parse(spec)));
}

export async function resolveBlockerAction(key: string) {
  return guarded(async () => {
    const client = db();
    const view = await loadAwardView(client);
    const b = view.blockers.find((x) => x.key === key);
    if (!b) throw new Error("That blocker is no longer open. Refresh and try again.");
    if (b.resolve.kind === "accept_value") await acceptItem(client, b.supplier!, `value:${b.resolve.valueId}`);
    else if (b.resolve.kind === "resolve_flag") {
      const valueFlag = view.data.cells[b.supplier!]?.[b.line ?? -1]?.openFlags.some((f) => f.id === (b.resolve as { flagId: string }).flagId);
      if (valueFlag) {
        await client.from("flag").update({ status: "resolved" }).eq("id", b.resolve.flagId);
        await recordAuditEvent({ actor: "priya", action: "resolve_flag", target: b.key, before: { status: "open" }, after: { status: "resolved" }, reason: b.detail }, client);
      } else await acceptItem(client, b.supplier!, `flag:${b.resolve.flagId}`);
    } else throw new Error("This blocker cannot be resolved here. Resolve it at the source, or override it with a reason.");
  });
}

export async function overrideBlockerAction(key: string, reason: string) {
  return guarded(async () => {
    // Refuse a short reason before loading anything; addOverride enforces it too.
    const problem = overrideReasonProblem(reason);
    if (problem) throw new Error(problem);
    const client = db();
    const view = await loadAwardView(client);
    const b = view.blockers.find((x) => x.key === key);
    if (!b) throw new Error("That blocker is no longer open. Refresh and try again.");
    await addOverride(client, { key: b.key, type: b.type, supplier: b.supplier, line: b.line, detail: b.detail }, reason);
  });
}

export async function removeOverrideAction(key: string) {
  return guarded(async () => removeOverride(db(), key));
}

export async function generateMemoAction() {
  return guarded(async () => {
    const client = db();
    const view = await loadAwardView(client);
    if (view.openBlockers > 0) throw new Error(`Resolve or override the ${view.openBlockers} open blocker${view.openBlockers === 1 ? "" : "s"} first.`);
    if (!view.chosen.allocation.length) throw new Error("This scenario awards no lines.");
    await enforceRateLimit(client, "memo");
    const facts = await buildMemoFacts(client, view);
    const memo = await writeAwardMemo(client, facts);
    await saveMemo(client, memo.markdown, memo.warnings as unknown as Json, {
      total: view.chosen.total_inr,
      vsL1: Math.round((view.chosen.nominal_l1_inr - view.chosen.total_inr) * 100) / 100,
      vsLastCycle: view.chosen.saving_vs_last_cycle_inr,
      allocations: view.chosen.allocation as unknown as Json,
    });
    return { warnings: memo.warnings.length, costUsd: memo.costUsd };
  });
}

export async function exportMemoAction(format: "pdf" | "md") {
  if (!(await hasValidSession())) return { ok: false as const, error: "Passcode required" };
  try {
    const client = db();
    const { award } = await getAward(client);
    if (!award?.memo_markdown) return { ok: false as const, error: "Generate the memo first." };
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    const title = "Award recommendation: IT Refresh 2026";
    const subtitle = `For Meera, Head of Commercial Finance · from Priya, Category Buyer · Meridian Diagnostics · as of ${formatDisplayDate(asOfDate())} · figures link to their comparison cells at ${origin}/award`;
    let bytes: Buffer;
    if (format === "pdf") {
      // Laid out like the preview on the Award screen; the memo text is as generated.
      const rfx = await client.from("rfx").select("title").single();
      const warnings = ((award.memo_warnings as { text: string; reason: string }[] | null) ?? []).map((w) => `${w.text} (${w.reason})`);
      bytes = Buffer.from(await memoToPdf({ markdown: award.memo_markdown, date: formatDisplayDate(asOfDate()), rfxTitle: rfx.data?.title ?? "IT Refresh 2026", warnings }));
    } else {
      const absolute = award.memo_markdown.replace(/\]\((\/[^)]+)\)/g, (_m, p: string) => `](${origin}${p})`);
      bytes = Buffer.from(`# ${title}\n\n_${subtitle}_\n\n${absolute}\n`, "utf8");
    }
    await client.from("award").update({ status: "exported" }).eq("id", award.id);
    await recordAuditEvent({ actor: "priya", action: `export_memo_${format}`, target: "award memo" }, client);
    return {
      ok: true as const,
      fileName: `award-memo-it-refresh-2026.${format}`,
      base64: bytes.toString("base64"),
      mime: format === "pdf" ? "application/pdf" : "text/markdown",
    };
  } catch (error) {
    return { ok: false as const, error: friendlyError(error, "The export") };
  }
}

// Stub: hands the negotiation team the lines worth pushing back on.
export async function sendToNegotiationAction() {
  if (!(await hasValidSession())) return { ok: false as const, error: "Passcode required" };
  try {
    const client = db();
    const view = await loadAwardView(client);
    const lines = negotiationLines(view.chosen);
    const pct = (v: number | null) => (v === null ? "" : `${v}%`);
    const bytes = documentToXlsx({
      title: "Negotiation targets: IT Refresh 2026",
      subtitle: "Awarded lines more than 5% above L1 or above last cycle. Target is the lower of L1 and last cycle.",
      blocks: [
        {
          type: "table",
          title: "Negotiation targets",
          header: ["Line", "Item", "Supplier", "Unit price", "Qty", "L1 supplier", "L1 price", "Above L1", "Last cycle", "Above last cycle", "Target price", "Why"],
          rows: lines.map((l) => [String(l.line), l.item, l.supplier, formatInr(l.unit_inr), String(l.quantity), l.l1_supplier ?? "", formatInr(l.l1_unit_inr), pct(l.above_l1_pct), formatInr(l.last_cycle_unit_inr), pct(l.above_last_cycle_pct), formatInr(l.target_unit_inr), l.reason]),
        },
      ],
    });
    await recordAuditEvent({ actor: "priya", action: "send_to_negotiation", target: "award", after: { lines: lines.map((l) => l.line) }, reason: "Stubbed hand-off to Aerchain negotiation" }, client);
    return { ok: true as const, count: lines.length, fileName: "negotiation-targets-it-refresh-2026.xlsx", base64: bytes.toString("base64"), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  } catch (error) {
    return { ok: false as const, error: friendlyError(error, "The export") };
  }
}

export async function convertToPoAction() {
  return guarded(async () => {
    const client = db();
    const { award } = await getAward(client);
    if (!award?.memo_generated_at) throw new Error("Generate and approve the memo first.");
    await recordAuditEvent({ actor: "priya", action: "convert_to_po", target: "award", reason: "Stubbed: purchase orders are created in the ERP after Meera approves" }, client);
    return "Stubbed: purchase orders are created in the ERP after Meera approves. Logged.";
  });
}
