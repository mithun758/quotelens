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
import type { AwardView, BlockerView } from "@/lib/award/view";
import { formatInr, formatInrCompact } from "@/lib/format/inr";
import { Markdown } from "../analyst/AnswerCard";
import { ErrorNote } from "../ErrorNote";
import { Stamp } from "../ui/Stamp";
import { btn, input } from "../ui/styles";

type Props = {
  view: Omit<AwardView, "award">;
  supplierNames: Record<string, string>;
  freshness: Record<string, string | null>;
  memo: { markdown: string; warnings: { text: string; reason: string }[]; generatedAt: string | null; status: string } | null;
  negotiationCount: number;
  memoDate: string;
  rfxTitle: string;
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

// A saving in words, never with a minus sign.
const delta = (saving: number) => (Math.abs(saving) < 0.5 ? "Same" : `${formatInrCompact(Math.abs(saving))} ${saving > 0 ? "lower" : "higher"}`);

function Check({ done }: { done: boolean }) {
  return done ? (
    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-xs bg-ledger text-white">
      <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
        <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <span className="sr-only">Done:</span>
    </span>
  ) : (
    <span className="mt-0.5 size-4 shrink-0 rounded-xs border-[1.5px] border-oxblood">
      <span className="sr-only">Open:</span>
    </span>
  );
}

export function AwardScreen({ view, supplierNames, freshness, memo, negotiationCount, memoDate, rfxTitle }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [resolved, setResolved] = useState<BlockerView[]>([]);
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries((view.spec.assignments ?? []).filter((a) => a.category).map((a) => [a.category!, a.supplier])),
  );
  const [customDefault, setCustomDefault] = useState(view.spec.default_supplier ?? "");
  const { spec, rows, chosen, blockers, openBlockers } = view;
  const chosenRow = rows.find((r) => r.scenario === spec.scenario);

  const [retry, setRetry] = useState<(() => void) | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, done?: string | ((d: unknown) => string)): void =>
    startTransition(async () => {
      setRetry(() => () => run(fn, done));
      setMessage(null);
      const r = await fn();
      if (!r.ok) setMessage({ tone: "error", text: r.error ?? "Something went wrong. Try again." });
      else if (done) setMessage({ tone: "ok", text: typeof done === "function" ? done(r.data) : done });
    });
  const save = (next: Partial<AwardSpec>) => {
    setResolved([]);
    run(() => saveSpecAction({ ...spec, ...next }));
  };

  const toggles: [keyof AwardSpec, string][] = [
    ["require_questionnaire", "Questionnaire passed only"],
    ["require_substitute_approval", "Substitutes approved by Arjun only"],
    ["exclude_stale", "Exclude Stale quotes"],
    ["exclude_reconfirm", "Exclude quotes needing reconfirmation"],
  ];
  const done = resolved.filter((r) => !blockers.some((b) => b.key === r.key));
  const total = blockers.length + done.length;
  const cleared = total - openBlockers;

  const metric = "border-b border-rule px-3 py-2 text-right align-top";
  const label = "sticky left-0 border-b border-rule bg-sheet px-3 py-2 text-left text-xs font-semibold text-slate align-top";
  const metrics: [string, (r: (typeof rows)[number]) => React.ReactNode][] = [
    ["Total", (r) => (r.available ? <span className="font-semibold">{r.totalDisplay}</span> : <span className="text-slate">Not available</span>)],
    [
      "Against last cycle",
      (r) =>
        r.available && (
          <span className={r.savingsVsLastCycle >= 0 ? "text-ledger" : "text-oxblood"}>
            {delta(r.savingsVsLastCycle)}
            {r.savingsVsLastCyclePct !== null && <span className="block text-xs">{Math.abs(r.savingsVsLastCyclePct)}%</span>}
          </span>
        ),
    ],
    ["Against L1", (r) => r.available && <span className={r.savingsVsL1 < 0 ? "text-oxblood" : ""}>{delta(r.savingsVsL1)}</span>],
    [
      "Suppliers",
      (r) => (
        <span className="flex flex-wrap justify-end gap-x-2 gap-y-1">
          {r.suppliers.length ? (
            r.suppliers.map((s) => (
              <span key={s} className="inline-flex items-center gap-1" title={supplierNames[s]}>
                {s}
                {freshness[s] && freshness[s] !== "Fresh" && <Stamp status={freshness[s]} />}
              </span>
            ))
          ) : (
            <span className="text-slate">None eligible</span>
          )}
        </span>
      ),
    ],
    [
      "Lines awarded",
      (r) => (
        <>
          {r.linesAwarded}
          {r.unallocated > 0 && <span className="block text-xs text-pencil">{r.unallocated} not covered</span>}
        </>
      ),
    ],
    ["Open blockers", (r) => r.available && <span className={r.openBlockers ? "font-semibold text-oxblood" : "text-ledger"}>{r.openBlockers || "None"}</span>],
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-xl font-semibold">Award</h1>
          <p className="text-sm text-slate">Compare scenarios, clear the blockers, then send the memo to Meera. Scenarios are computed by code; QuoteLens never awards on its own.</p>
        </div>
        {chosenRow?.available && (
          <dl className="shrink-0 text-right">
            <dt className="text-xs text-slate">Chosen: {chosenRow.label}</dt>
            <dd className="text-[28px] font-semibold leading-[34px]">{chosenRow.totalDisplay}</dd>
            <dd className={`text-xs ${chosenRow.savingsVsLastCycle >= 0 ? "text-ledger" : "text-oxblood"}`}>{delta(chosenRow.savingsVsLastCycle)} than last cycle</dd>
          </dl>
        )}
      </header>

      <div aria-live="polite">{message?.tone === "ok" && <p className="border-l-[3px] border-ledger bg-ledger-tint px-3 py-2 text-sm text-ledger">{message.text}</p>}</div>
      {message?.tone === "error" && <ErrorNote message={message.text} busy={pending} onRetry={retry ?? undefined} />}

      <section aria-labelledby="scenarios-title" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="scenarios-title" className="text-base font-semibold">
            Scenarios
          </h2>
          <fieldset className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]" disabled={pending}>
            <legend className="sr-only">Eligibility</legend>
            {toggles.map(([key, text]) => (
              <label key={key} className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-ink" checked={spec[key] as boolean} onChange={(e) => save({ [key]: e.target.checked })} />
                {text}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="overflow-x-auto border border-rule bg-sheet">
          <table className="w-full min-w-[56rem] table-fixed border-separate border-spacing-0 text-[13px]">
            <colgroup>
              <col className="w-[9rem]" />
              {rows.map((r) => (
                <col key={r.scenario} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className={`${label} border-b-ink`}>
                  <span className="sr-only">Measure</span>
                </th>
                {rows.map((r) => {
                  const active = r.scenario === spec.scenario;
                  return (
                    <th
                      key={r.scenario}
                      id={`scenario-${r.scenario}`}
                      scope="col"
                      className={`border-b border-t-[3px] border-b-ink px-3 pb-2 pt-3 text-right align-bottom ${active ? "border-t-ink bg-tint" : "border-t-transparent"}`}
                    >
                      <span className="block text-sm font-semibold">{r.label}</span>
                      {active ? (
                        <span className="mt-1 block text-xs font-semibold">Chosen</span>
                      ) : (
                        <button type="button" disabled={pending || !r.available} onClick={() => save({ scenario: r.scenario })} className={`${btn.small} mt-1`}>
                          Use this scenario
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {metrics.map(([name, cell]) => (
                <tr key={name}>
                  <th scope="row" className={label}>
                    {name}
                  </th>
                  {rows.map((r) => (
                    <td key={r.scenario} className={`${metric} ${r.scenario === spec.scenario ? "bg-tint" : ""}`}>
                      {cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate">Against L1 compares with the lowest counted price on every awarded line across all suppliers. Against last cycle uses Meridian&apos;s last-cycle prices on the same lines.</p>

        <details className="border-y border-rule py-2 text-sm" open={spec.scenario === "custom"}>
          <summary className="cursor-pointer font-semibold">Custom allocation</summary>
          <div className="mt-2 grid grid-cols-5 gap-3">
            {view.categories.map((c) => (
              <label key={c} className="text-xs text-slate">
                {c}
                <select value={custom[c] ?? ""} onChange={(e) => setCustom({ ...custom, [c]: e.target.value })} className={`${input} mt-1 w-full`}>
                  <option value="">Use default</option>
                  {view.suppliers.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code}. {s.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="text-xs text-slate">
              Everything else
              <select value={customDefault} onChange={(e) => setCustomDefault(e.target.value)} className={`${input} mt-1 w-full`}>
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
            className={`${btn.primary} mt-3`}
          >
            Use custom allocation
          </button>
        </details>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="chosen-title">
            <h2 id="chosen-title" className="border-b border-ink pb-1 text-base font-semibold">
              {chosenRow?.label ?? spec.scenario}, by supplier
            </h2>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-xs text-slate">
                  <th className="border-b border-rule py-1 text-left font-semibold">Supplier</th>
                  <th className="border-b border-rule py-1 text-left font-semibold">Lines</th>
                  <th className="border-b border-rule py-1 text-right font-semibold">Discount</th>
                  <th className="border-b border-rule py-1 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {chosen.by_supplier.map((b) => (
                  <tr key={b.supplier} className="align-top">
                    <td className="border-b border-rule py-2 pr-2">
                      <span className="flex flex-wrap items-center gap-2">
                        {b.supplier}. {supplierNames[b.supplier]} {b.freshness && b.freshness !== "Fresh" && <Stamp status={b.freshness} />}
                      </span>
                    </td>
                    <td className="border-b border-rule py-2 pr-2 text-xs text-slate">{b.lines.join(", ")}</td>
                    <td className="whitespace-nowrap border-b border-rule py-2 pl-2 text-right">{b.discount_inr ? formatInr(b.discount_inr) : ""}</td>
                    <td className="whitespace-nowrap border-b border-rule py-2 pl-3 text-right font-semibold">{formatInrCompact(b.total_inr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-2 space-y-1 text-xs text-slate">
              {view.eligibility.map((e) => (
                <li key={e}>{e}</li>
              ))}
              {chosen.discounts.map((d, i) => (
                <li key={i}>
                  {supplierNames[d.supplier]}: {d.percent}% discount {d.applied ? "applied" : "not applied"}. {d.reason}.
                </li>
              ))}
              {chosen.prior_pricing_lines.length > 0 && (
                <li className="text-pencil">Lines {chosen.prior_pricing_lines.join(", ")} rest on a &quot;same as last year&quot; price and may look cheap because they reflect last year&apos;s market.</li>
              )}
            </ul>
          </section>

          <section aria-labelledby="blockers-title">
            <div className="border-b border-ink pb-1">
              <h2 id="blockers-title" className="text-base font-semibold">
                Before the memo
              </h2>
              <p className="text-xs text-slate">
                {total === 0
                  ? "Nothing blocks this scenario."
                  : openBlockers
                    ? `${cleared} of ${total} cleared. Accept each one, or override it with a typed reason; overrides are logged and printed in the memo.`
                    : `All ${total} cleared. Generate the memo.`}
              </p>
            </div>
            <ul>
              {done.map((b) => (
                <li key={b.key} className="settle flex gap-2 border-b border-rule py-2 text-[13px] text-slate">
                  <Check done />
                  <span>
                    <span className="line-through decoration-field">
                      {b.supplier ? `${b.supplier}. ${supplierNames[b.supplier]}` : BLOCKER_LABEL[b.type]}
                      {b.line !== null ? `, line ${b.line}` : ""}
                    </span>{" "}
                    <span className="text-ledger">Accepted</span>
                  </span>
                </li>
              ))}
              {blockers.map((b) => (
                <li key={b.key} className="flex gap-2 border-b border-rule py-2 text-[13px]">
                  <Check done={!!b.override} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className={b.override ? "text-slate line-through decoration-field" : "font-semibold"}>
                        {b.supplier ? `${b.supplier}. ${supplierNames[b.supplier]}` : BLOCKER_LABEL[b.type]}
                        {b.line !== null ? `, line ${b.line}` : ""}
                      </span>
                      <span className="text-xs text-slate">{BLOCKER_LABEL[b.type]}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate">{b.detail}</p>
                    {b.override ? (
                      <p className="mt-1 text-xs">
                        Overridden: “{b.override.reason}”{" "}
                        <button type="button" disabled={pending} onClick={() => run(() => removeOverrideAction(b.key))} className="underline decoration-field underline-offset-2 hover:decoration-ink">
                          Withdraw override
                        </button>
                      </p>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {b.resolve.kind !== "none" ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(async () => {
                                const r = await resolveBlockerAction(b.key);
                                if (r.ok) setResolved((x) => [...x, b]);
                                return r;
                              })
                            }
                            className={btn.small}
                          >
                            {b.resolve.kind === "accept_value" ? "Accept value" : "Accept flag"}
                          </button>
                        ) : (
                          <span className="text-xs">To resolve: {b.resolveBy}.</span>
                        )}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setOverriding(overriding === b.key ? null : b.key);
                            setReason("");
                          }}
                          className={btn.small}
                        >
                          Override
                        </button>
                        {b.supplier && b.line !== null && (
                          <Link href={`/comparison?cell=${b.supplier}-${b.line}`} className="text-xs underline decoration-field underline-offset-2 hover:decoration-ink">
                            Show in comparison
                          </Link>
                        )}
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
                        <input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          required
                          minLength={10}
                          placeholder="Reason, printed in the memo"
                          aria-label="Override reason"
                          className={`${input} min-w-[14rem] flex-1 py-1 text-[13px]`}
                        />
                        <button type="submit" disabled={pending || reason.trim().length < 10} className={btn.smallPrimary}>
                          Override with reason
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="memo-title" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="memo-title" className="text-base font-semibold">
                Memo for Meera
              </h2>
              <p className="text-xs text-slate">Written by Claude from computed results only; every figure links to its cell.</p>
            </div>
            <button
              type="button"
              disabled={pending || openBlockers > 0}
              onClick={() => run(generateMemoAction, (d) => `Memo written${(d as { warnings: number }).warnings ? ` with ${(d as { warnings: number }).warnings} post-check warning(s)` : ""}.`)}
              className={btn.primary}
            >
              {pending ? "Working..." : memo ? "Regenerate memo" : "Generate memo"}
            </button>
          </div>

          <article aria-label="Memo preview" className="border border-rule bg-sheet px-10 py-9 shadow-[0_8px_24px_rgb(27_42_65/0.06)]">
            <header className="border-b-2 border-ink pb-3">
              <p className="text-xl font-semibold">Award recommendation</p>
              <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-y-0.5 text-[13px]">
                <dt className="text-slate">To</dt>
                <dd>Meera, Head of Commercial Finance</dd>
                <dt className="text-slate">From</dt>
                <dd>Priya, Category Buyer</dd>
                <dt className="text-slate">Date</dt>
                <dd>{memoDate}</dd>
                <dt className="text-slate">RFx</dt>
                <dd>{rfxTitle}</dd>
              </dl>
            </header>
            {memo ? (
              <div className="pt-3">
                {memo.warnings.length > 0 && <p className="mb-3 border-l-[3px] border-amber bg-amber-tint px-2 py-1 text-xs text-pencil">Post-check: {memo.warnings.map((w) => `${w.text} (${w.reason})`).join("; ")}.</p>}
                <Markdown text={memo.markdown} size="doc" />
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-slate">
                {pending
                  ? "Writing the memo. This takes about 10 seconds."
                  : openBlockers
                    ? `Clear the ${openBlockers} open blocker${openBlockers === 1 ? "" : "s"} first, then generate the memo.`
                    : "Ready. Generate the memo to see it here."}
              </p>
            )}
            <footer className="mt-6 grid grid-cols-2 gap-6 border-t border-rule pt-3 text-xs text-slate">
              <p>
                Approved by
                <span className="mt-6 block border-b border-field" />
              </p>
              <p>
                Date
                <span className="mt-6 block border-b border-field" />
              </p>
            </footer>
          </article>

          {memo && (
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
                  className={btn.secondary}
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
                className={btn.secondary}
              >
                Send to negotiation ({negotiationCount} line{negotiationCount === 1 ? "" : "s"})
              </button>
              <button type="button" disabled={pending} onClick={() => run(convertToPoAction, (d) => String(d))} className={btn.secondary}>
                Convert to PO
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
