"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  convertToPoAction,
  exportMemoAction,
  generateMemoAction,
  overrideBlockerAction,
  removeOverrideAction,
  resolveBlockerAction,
  saveSpecAction,
  sendToNegotiationAction,
} from "@/app/(app)/award/actions";
import type { AwardSpec } from "@/lib/award/spec";
import type { AwardView } from "@/lib/award/view";
import { formatInr, formatInrCompact } from "@/lib/format/inr";
import { Markdown } from "../analyst/AnswerCard";
import { ErrorNote } from "../ErrorNote";

type Props = {
  view: Omit<AwardView, "award">;
  supplierNames: Record<string, string>;
  freshness: Record<string, string | null>;
  memo: { markdown: string; warnings: { text: string; reason: string }[]; generatedAt: string | null; status: string } | null;
  negotiationCount: number;
};

const BLOCKER_LABEL: Record<string, string> = {
  inferred_value: "Inferred value",
  open_flag: "Open flag",
  stale_supplier: "Stale quote",
  awaiting_clarification: "Awaiting supplier",
  questionnaire_failure: "Questionnaire",
  unallocated_line: "Line not covered",
};

function download(fileName: string, base64: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const signed = (n: number, display: string) => (n < 0 ? `${display.replace("−", "")} more` : display);

export function AwardScreen({ view, supplierNames, freshness, memo, negotiationCount }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries((view.spec.assignments ?? []).filter((a) => a.category).map((a) => [a.category!, a.supplier])),
  );
  const [customDefault, setCustomDefault] = useState(view.spec.default_supplier ?? "");
  const { spec, rows, chosen, blockers, openBlockers } = view;

  const [retry, setRetry] = useState<(() => void) | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, done?: string | ((d: unknown) => string)): void =>
    startTransition(async () => {
      setRetry(() => () => run(fn, done));
      setMessage(null);
      const r = await fn();
      if (!r.ok) setMessage({ tone: "error", text: r.error ?? "Something went wrong" });
      else if (done) setMessage({ tone: "ok", text: typeof done === "function" ? done(r.data) : done });
    });
  const save = (next: Partial<AwardSpec>) => run(() => saveSpecAction({ ...spec, ...next }));

  const toggles: [keyof AwardSpec, string][] = [
    ["require_questionnaire", "Questionnaire passed only"],
    ["require_substitute_approval", "Substitutes approved by Arjun only"],
    ["exclude_stale", "Exclude Stale quotes"],
    ["exclude_reconfirm", "Exclude quotes needing reconfirmation"],
  ];

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Award</h2>
        <p className="text-sm text-zinc-600">Compare award scenarios, clear the blockers, and send a memo to Meera. Scenarios are computed by code; QuoteLens never awards on its own.</p>
      </div>

      {message?.tone === "ok" && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message.text}</p>}
      {message?.tone === "error" && <ErrorNote message={message.text} busy={pending} onRetry={retry ?? undefined} />}

      <fieldset className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm" disabled={pending}>
        <legend className="px-1 text-xs font-medium text-zinc-500">Eligibility</legend>
        {toggles.map(([key, label]) => (
          <label key={key} className="flex items-center gap-1.5">
            <input type="checkbox" checked={spec[key] as boolean} onChange={(e) => save({ [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">Scenario</th>
              <th className="px-3 py-2 text-left">Suppliers</th>
              <th className="px-3 py-2 text-right">Lines</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Savings vs L1</th>
              <th className="px-3 py-2 text-right">Savings vs last cycle</th>
              <th className="px-3 py-2 text-right">Open blockers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const active = r.scenario === spec.scenario;
              return (
                <tr key={r.scenario} id={`scenario-${r.scenario}`} className={`border-t border-zinc-100 ${active ? "bg-sky-50" : ""}`}>
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="scenario" checked={active} disabled={pending || !r.available} onChange={() => save({ scenario: r.scenario })} />
                      <span className="font-medium">{r.label}</span>
                    </label>
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{r.suppliers.length ? r.suppliers.map((s) => `${s}${freshness[s] && freshness[s] !== "Fresh" ? ` (${freshness[s]})` : ""}`).join(", ") : "No eligible supplier"}</td>
                  <td className="px-3 py-2 text-right">
                    {r.linesAwarded}
                    {r.unallocated > 0 && <span className="text-xs text-amber-800"> (+{r.unallocated} not covered)</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{r.available ? r.totalDisplay : "none"}</td>
                  <td className={`px-3 py-2 text-right ${r.savingsVsL1 < 0 ? "text-red-700" : ""}`}>{r.available ? signed(r.savingsVsL1, r.savingsVsL1Display) : ""}</td>
                  <td className={`px-3 py-2 text-right ${r.savingsVsLastCycle < 0 ? "text-red-700" : "text-emerald-800"}`}>
                    {r.available ? signed(r.savingsVsLastCycle, r.savingsVsLastCycleDisplay) : ""}
                    {r.available && r.savingsVsLastCyclePct !== null && <span className="block text-xs text-zinc-500">{r.savingsVsLastCyclePct}%</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{r.available ? <span className={r.openBlockers ? "font-medium text-amber-800" : "text-emerald-700"}>{r.openBlockers}</span> : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500">
          Savings vs L1 compares with the lowest counted price on every awarded line across all suppliers; a red figure is a premium. Savings vs last cycle compares with
          Meridian&apos;s last-cycle prices on the same lines.
        </p>
      </div>

      <details className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm" open={spec.scenario === "custom"}>
        <summary className="cursor-pointer font-medium">Custom allocation</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {view.categories.map((c) => (
            <label key={c} className="text-xs">
              {c}
              <select value={custom[c] ?? ""} onChange={(e) => setCustom({ ...custom, [c]: e.target.value })} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm">
                <option value="">Use default</option>
                {view.suppliers.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code}. {s.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="text-xs">
            Everything else
            <select value={customDefault} onChange={(e) => setCustomDefault(e.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm">
              <option value="">Leave unallocated</option>
              {view.suppliers.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code}. {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={pending || (!customDefault && !Object.values(custom).some(Boolean))}
          onClick={() =>
            save({
              scenario: "custom",
              assignments: Object.entries(custom)
                .filter(([, s]) => s)
                .map(([category, supplier]) => ({ category, supplier })),
              default_supplier: customDefault || undefined,
            })
          }
          className="mt-2 rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Use custom allocation
        </button>
      </details>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
          <h3 className="text-sm font-semibold">Chosen: {rows.find((r) => r.scenario === spec.scenario)?.label ?? spec.scenario}</h3>
          <ul className="list-disc pl-5 text-xs text-zinc-600">
            {view.eligibility.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 text-left">Supplier</th>
                <th className="py-1 text-left">Lines</th>
                <th className="py-1 text-right">Subtotal</th>
                <th className="py-1 text-right">Discount</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {chosen.by_supplier.map((b) => (
                <tr key={b.supplier} className="border-t border-zinc-100">
                  <td className="py-1">
                    {b.supplier}. {supplierNames[b.supplier]} <span className="text-xs text-zinc-500">{b.freshness}</span>
                  </td>
                  <td className="py-1 text-xs text-zinc-600">{b.lines.join(", ")}</td>
                  <td className="py-1 text-right">{formatInrCompact(b.subtotal_inr)}</td>
                  <td className="py-1 text-right">{b.discount_inr ? `−${formatInr(b.discount_inr)}` : ""}</td>
                  <td className="py-1 text-right font-medium">{formatInrCompact(b.total_inr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {chosen.discounts.map((d, i) => (
            <p key={i} className="text-xs text-zinc-600">
              {supplierNames[d.supplier]}: {d.percent}% discount {d.applied ? "applied" : "not applied"}. {d.reason}.
            </p>
          ))}
          {chosen.prior_pricing_lines.length > 0 && (
            <p className="text-xs text-amber-900">
              Lines {chosen.prior_pricing_lines.join(", ")} rest on a &quot;same as last year&quot; price and may look cheap because they reflect last year&apos;s market.
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
          <h3 className="text-sm font-semibold">{openBlockers ? `${openBlockers} blocker${openBlockers === 1 ? "" : "s"} before the memo` : "No open blockers"}</h3>
          <p className="text-xs text-zinc-500">Resolve each one, or override it with a typed reason. Overrides are logged and printed in the memo.</p>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
            {blockers.map((b) => (
              <li key={b.key} className={`rounded border p-2 text-sm ${b.override ? "border-zinc-200 bg-zinc-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-white px-1.5 py-0.5 text-xs font-medium ring-1 ring-zinc-200">{BLOCKER_LABEL[b.type]}</span>
                  <span className="font-medium">
                    {b.supplier ? `${b.supplier}. ${supplierNames[b.supplier]}` : ""}
                    {b.line !== null ? ` · line ${b.line}` : ""}
                  </span>
                  {b.supplier && b.line !== null && (
                    <Link href={`/comparison?cell=${b.supplier}-${b.line}`} className="text-xs text-sky-800 underline underline-offset-2">
                      View cell
                    </Link>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-700">{b.detail}</p>
                {b.override ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-zinc-700">Overridden: “{b.override.reason}”</span>
                    <button type="button" disabled={pending} onClick={() => run(() => removeOverrideAction(b.key))} className="text-zinc-600 underline underline-offset-2">
                      Withdraw
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {b.resolve.kind !== "none" ? (
                      <button type="button" disabled={pending} onClick={() => run(() => resolveBlockerAction(b.key))} className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs hover:bg-zinc-100">
                        {b.resolve.kind === "accept_value" ? "Resolve: accept value" : "Resolve: clear flag"}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-600">To resolve: {b.resolveBy}.</span>
                    )}
                    <button type="button" disabled={pending} onClick={() => { setOverriding(overriding === b.key ? null : b.key); setReason(""); }} className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs hover:bg-zinc-100">
                      Override
                    </button>
                  </div>
                )}
                {overriding === b.key && (
                  <form
                    className="mt-2 flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () => {
                        const r = await overrideBlockerAction(b.key, reason);
                        if (r.ok) setOverriding(null);
                        return r;
                      });
                    }}
                  >
                    <input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} placeholder="Reason (printed in the memo)" aria-label="Override reason" className="min-w-[16rem] flex-1 rounded border border-zinc-300 px-2 py-1 text-xs" />
                    <button type="submit" disabled={pending || reason.trim().length < 10} className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-50">
                      Override with reason
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Award memo for Meera</h3>
            <p className="text-xs text-zinc-500">One page, written by Claude from computed results only. Every figure links to its comparison cell.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || openBlockers > 0}
              title={openBlockers ? `Resolve or override ${openBlockers} blocker${openBlockers === 1 ? "" : "s"} first` : undefined}
              onClick={() => run(generateMemoAction, (d) => `Memo written${(d as { warnings: number }).warnings ? ` with ${(d as { warnings: number }).warnings} post-check warning(s)` : ""}.`)}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Working..." : memo ? "Regenerate memo" : "Generate memo"}
            </button>
            {openBlockers > 0 && <span className="self-center text-xs text-amber-800">Disabled: {openBlockers} open blocker{openBlockers === 1 ? "" : "s"}</span>}
          </div>
        </div>
        {memo && (
          <>
            {memo.warnings.length > 0 && (
              <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                Post-check: {memo.warnings.map((w) => `${w.text} (${w.reason})`).join("; ")}.
              </p>
            )}
            <div className="rounded border border-zinc-200 p-4">
              <Markdown text={memo.markdown} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["pdf", "md"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await exportMemoAction(f);
                      if (r.ok) download(r.fileName, r.base64, r.mime);
                      else setMessage({ tone: "error", text: r.error });
                    })
                  }
                  className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100"
                >
                  Export {f === "pdf" ? "PDF" : "Markdown"}
                </button>
              ))}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await sendToNegotiationAction();
                    if (r.ok) {
                      download(r.fileName, r.base64, r.mime);
                      setMessage({ tone: "ok", text: `Stubbed hand-off to negotiation: ${r.count} line${r.count === 1 ? "" : "s"} more than 5% above L1 or last cycle exported. Logged.` });
                    } else setMessage({ tone: "error", text: r.error });
                  })
                }
                className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100"
              >
                Send to negotiation ({negotiationCount} line{negotiationCount === 1 ? "" : "s"})
              </button>
              <button type="button" disabled={pending} onClick={() => run(convertToPoAction, (d) => String(d))} className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100">
                Convert to PO
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
