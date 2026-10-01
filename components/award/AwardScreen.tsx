"use client";

import { Check, CircleSlash, ClipboardX, Clock, Flag, Mail, PenLine, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { OVERRIDE_MIN_CHARS as OVERRIDE_MIN } from "@/lib/award/override";
import { memoLayout } from "@/lib/award/memoLayout";
import type { AwardSpec } from "@/lib/award/spec";
import type { AwardView, BlockerView } from "@/lib/award/view";
import { formatInr, formatInrCompact } from "@/lib/format/inr";
import { cn } from "@/lib/utils";
import { Markdown } from "../analyst/AnswerCard";
import { ErrorNote } from "../ErrorNote";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Progress } from "../ui/progress";
import { SectionHeader } from "../ui/ScreenHeader";
import { Stamp } from "../ui/Stamp";
import { input } from "../ui/styles";
import { Textarea } from "../ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type Props = {
  view: Omit<AwardView, "award">;
  supplierNames: Record<string, string>;
  freshness: Record<string, string | null>;
  memo: { markdown: string; warnings: { text: string; reason: string }[]; generatedAt: string | null; status: string } | null;
  negotiationCount: number;
  memoDate: string;
  rfxTitle: string;
  readiness: { ready: number; total: number };
};

const BLOCKER: Record<string, { label: string; icon: LucideIcon }> = {
  inferred_value: { label: "Inferred value", icon: PenLine },
  open_flag: { label: "Open flag", icon: Flag },
  stale_supplier: { label: "Stale quote", icon: Clock },
  awaiting_clarification: { label: "Awaiting supplier", icon: Mail },
  questionnaire_failure: { label: "Questionnaire", icon: ClipboardX },
  unallocated_line: { label: "Line not covered", icon: CircleSlash },
};
const blockerLabel = (t: string) => BLOCKER[t]?.label ?? t.replace(/_/g, " ");

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
const againstLast = (saving: number) => (Math.abs(saving) < 0.5 ? "The same as last cycle" : `${formatInrCompact(Math.abs(saving))} ${saving > 0 ? "less" : "more"} than last cycle`);

const FRESH_TONE: Record<string, "neutral" | "pencil" | "oxblood"> = { Fresh: "neutral", Reconfirm: "pencil", Stale: "oxblood" };

export function AwardScreen({ view, supplierNames, freshness, memo, negotiationCount, memoDate, rfxTitle, readiness }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [overriding, setOverriding] = useState<BlockerView | null>(null);
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
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong. Try again.");
      else if (done) toast(typeof done === "function" ? done(r.data) : done);
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
  const open = blockers.filter((b) => !b.override);

  const metrics: [string, (r: (typeof rows)[number]) => React.ReactNode][] = [
    ["Total", (r) => (r.available ? <span className="text-heading font-semibold">{r.totalDisplay}</span> : <span className="text-slate">Not available</span>)],
    [
      "Against last cycle",
      (r) =>
        r.available && (
          <span className={r.savingsVsLastCycle >= 0 ? "text-ledger" : "text-oxblood"}>
            {delta(r.savingsVsLastCycle)}
            {r.savingsVsLastCyclePct !== null && <span className="block text-meta">{Math.abs(r.savingsVsLastCyclePct)}%</span>}
          </span>
        ),
    ],
    ["Against L1", (r) => r.available && <span className={r.savingsVsL1 < 0 ? "text-oxblood" : ""}>{delta(r.savingsVsL1)}</span>],
    [
      "Suppliers",
      (r) => (
        <span className="flex flex-wrap justify-end gap-1">
          {r.suppliers.length ? (
            r.suppliers.map((s) => (
              <Tooltip key={s}>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Badge variant={FRESH_TONE[freshness[s] ?? "Fresh"] ?? "neutral"} className="font-semibold">
                      {s}
                      {freshness[s] && freshness[s] !== "Fresh" && <span className="font-normal">{freshness[s]}</span>}
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {supplierNames[s]}
                  {freshness[s] ? `, ${freshness[s]}` : ""}
                </TooltipContent>
              </Tooltip>
            ))
          ) : (
            <span className="text-slate">None eligible</span>
          )}
        </span>
      ),
    ],
    [
      "Lines",
      (r) => (
        <>
          {r.linesAwarded}
          {r.unallocated > 0 && <span className="block text-meta text-pencil">{r.unallocated} not covered</span>}
        </>
      ),
    ],
    ["Blockers", (r) => r.available && <span className={r.openBlockers ? "font-semibold text-oxblood" : "text-ledger"}>{r.openBlockers || "None"}</span>],
  ];
  const chosenCol = (r: (typeof rows)[number]) => r.scenario === spec.scenario;
  const label = "sticky left-0 z-10 border-b border-rule bg-sheet px-3 py-2 text-left align-top text-meta font-semibold text-slate";

  const generate = (
    <Button variant="primary" disabled={pending || openBlockers > 0} onClick={() => run(generateMemoAction, (d) => `Memo generated${(d as { warnings: number }).warnings ? ` with ${(d as { warnings: number }).warnings} post-check warning(s)` : ""}`)}>
      {pending ? "Working..." : memo ? "Regenerate memo" : "Generate memo"}
    </Button>
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-title font-semibold">Award</h1>
          <p className="text-body text-slate">Compare scenarios, clear the blockers, then send the memo to Meera. Scenarios are computed by code; QuoteLens never awards on its own.</p>
        </div>
        {chosenRow?.available && (
          <dl className="shrink-0 @4xl:text-right">
            <dt className="text-meta text-slate">Chosen scenario: {chosenRow.label}</dt>
            <dd className="text-display font-semibold">{chosenRow.totalDisplay}</dd>
            <dd className="text-meta text-slate">{againstLast(chosenRow.savingsVsLastCycle)}</dd>
          </dl>
        )}
      </header>

      {error && <ErrorNote message={error} busy={pending} onRetry={retry ?? undefined} />}

      <section aria-labelledby="scenarios-title" className="space-y-3">
        <SectionHeader id="scenarios-title" title="Scenarios" description="Each scenario is computed from the comparison with the eligibility rules below." />
        <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-body" disabled={pending}>
          <legend className="sr-only">Eligibility</legend>
          {toggles.map(([key, text]) => (
            <label key={key} className="flex items-center gap-2">
              <Checkbox checked={spec[key] as boolean} onCheckedChange={(c) => save({ [key]: c === true })} disabled={pending} />
              {text}
            </label>
          ))}
        </fieldset>
        <div className="overflow-x-auto rounded-xs border border-rule bg-sheet">
          <table className="w-full min-w-[56rem] table-fixed border-separate border-spacing-0 text-table">
            <colgroup>
              <col className="w-36" />
              {rows.map((r) => (
                <col key={r.scenario} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className={cn(label, "border-b-2 border-b-rule-strong")}>
                  <span className="sr-only">Measure</span>
                </th>
                {rows.map((r) => (
                  <th
                    key={r.scenario}
                    id={`scenario-${r.scenario}`}
                    scope="col"
                    className={cn("border-b-2 border-b-rule-strong px-3 py-2 text-right align-bottom", chosenCol(r) && "border-x-2 border-t-2 border-x-ink border-t-ink")}
                  >
                    <span className="block text-body font-semibold">{r.label}</span>
                    {chosenCol(r) && <span className="text-meta text-slate">Chosen</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(([name, cell]) => (
                <tr key={name}>
                  <th scope="row" className={label}>
                    {name}
                  </th>
                  {rows.map((r) => (
                    <td key={r.scenario} className={cn("border-b border-rule px-3 py-2 text-right align-top", chosenCol(r) && "border-x-2 border-x-ink")}>
                      {cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row" className={cn(label, "border-b-0")}>
                  <span className="sr-only">Choose</span>
                </th>
                {rows.map((r) => (
                  <td key={r.scenario} className={cn("px-3 py-3 text-right", chosenCol(r) && "border-x-2 border-b-2 border-ink")}>
                    {chosenCol(r) ? (
                      <span className="inline-flex items-center gap-1 text-meta font-semibold text-ink">
                        <Check aria-hidden className="size-3.5 stroke-[1.5]" />
                        In use
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" disabled={pending || !r.available} onClick={() => save({ scenario: r.scenario })} aria-describedby={`scenario-${r.scenario}`}>
                        Use this scenario
                      </Button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-meta text-slate">Against L1 compares with the lowest counted price on every awarded line across all suppliers. Against last cycle uses Meridian&apos;s last-cycle prices on the same lines.</p>

        <details className="rounded-xs border border-rule bg-sheet px-4 py-3 text-body" open={spec.scenario === "custom"}>
          <summary className="cursor-pointer font-semibold">Custom allocation</summary>
          <div className="mt-3 grid grid-cols-2 gap-3 @3xl:grid-cols-5">
            {view.categories.map((c) => (
              <label key={c} className="text-meta text-slate">
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
            <label className="text-meta text-slate">
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
          <Button
            variant="primary"
            className="mt-3"
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
          >
            Use custom allocation
          </Button>
        </details>
      </section>

      <div className="grid gap-8 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="chosen-title" className="space-y-3">
            <SectionHeader id="chosen-title" title={`${chosenRow?.label ?? spec.scenario}, by supplier`} />
            <div className="rounded-xs border border-rule bg-sheet">
              <table className="w-full border-collapse text-table">
                <thead>
                  <tr className="text-meta text-slate">
                    <th className="border-b-2 border-rule-strong px-3 py-2 text-left font-semibold">Supplier</th>
                    <th className="border-b-2 border-rule-strong px-3 py-2 text-left font-semibold">Lines</th>
                    <th className="border-b-2 border-rule-strong px-3 py-2 text-right font-semibold">Discount</th>
                    <th className="border-b-2 border-rule-strong px-3 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {chosen.by_supplier.map((b) => (
                    <tr key={b.supplier} className="align-top">
                      <td className="border-b border-rule px-3 py-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <span>
                            <span className="text-slate">{b.supplier}</span> {supplierNames[b.supplier]}
                          </span>
                          {b.freshness && b.freshness !== "Fresh" && <Stamp status={b.freshness} />}
                        </span>
                      </td>
                      <td className="border-b border-rule px-3 py-2 text-meta text-slate">{b.lines.join(", ")}</td>
                      <td className="border-b border-rule px-3 py-2 text-right whitespace-nowrap">{b.discount_inr ? formatInr(b.discount_inr) : ""}</td>
                      <td className="border-b border-rule px-3 py-2 text-right font-semibold whitespace-nowrap">{formatInrCompact(b.total_inr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-1 text-meta text-slate">
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

          <section id="readiness" aria-labelledby="blockers-title" className="scroll-mt-20 rounded-xs border border-rule bg-sheet">
            <div className="space-y-2 border-b border-rule px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="blockers-title" className="text-heading font-semibold">
                  Decision readiness
                </h2>
                <span className={cn("text-meta font-semibold", readiness.ready === readiness.total ? "text-ledger" : "text-slate")}>
                  {readiness.ready} of {readiness.total} lines ready for award
                </span>
              </div>
              <Progress value={total ? (cleared / total) * 100 : 100} aria-label={`${cleared} of ${total} resolved`} />
              <p className="text-meta text-slate">
                {total === 0
                  ? "Nothing blocks this scenario."
                  : openBlockers
                    ? `${cleared} of ${total} resolved. Accept each one, or override it with a reason; overrides are logged and printed in the memo.`
                    : `All ${total} resolved. Generate the memo.`}
              </p>
            </div>
            <ul>
              {done.map((b) => (
                <li key={b.key} className="settle flex gap-3 border-b border-rule px-4 py-3 text-table text-slate">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-ledger" />
                  <span>
                    <span className="line-through decoration-slate">
                      {b.supplier ? `${b.supplier}. ${supplierNames[b.supplier]}` : blockerLabel(b.type)}
                      {b.line !== null ? `, line ${b.line}` : ""}
                    </span>{" "}
                    <span className="text-ledger">Accepted</span>
                  </span>
                </li>
              ))}
              {blockers.map((b) => {
                const Icon = BLOCKER[b.type]?.icon ?? Flag;
                return (
                  <li key={b.key} className="flex gap-3 border-b border-rule px-4 py-3 text-table last:border-b-0">
                    {b.override ? (
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-ledger" />
                    ) : (
                      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-oxblood" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className={b.override ? "text-slate line-through decoration-slate" : "font-semibold"}>
                          {blockerLabel(b.type)}
                          <span className="font-normal text-slate">
                            {b.supplier ? `, ${supplierNames[b.supplier]}` : ""}
                            {b.line !== null ? `, line ${b.line}` : ""}
                          </span>
                        </span>
                      </div>
                      <p className="mt-0.5 text-meta text-slate">{b.detail}</p>
                      {b.override ? (
                        <p className="mt-1 text-meta">
                          Overridden: “{b.override.reason}”{" "}
                          <button type="button" disabled={pending} onClick={() => run(() => removeOverrideAction(b.key), "Override withdrawn")} className="underline decoration-slate underline-offset-2 hover:decoration-ink">
                            Withdraw override
                          </button>
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {b.resolve.kind !== "none" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() =>
                                run(async () => {
                                  const r = await resolveBlockerAction(b.key);
                                  if (r.ok) setResolved((x) => [...x, b]);
                                  return r;
                                }, b.resolve.kind === "accept_value" ? "Value accepted" : "Flag accepted")
                              }
                            >
                              {b.resolve.kind === "accept_value" ? "Accept value" : "Accept flag"}
                            </Button>
                          ) : (
                            <span className="text-meta">To resolve: {b.resolveBy}.</span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => {
                              setOverriding(b);
                              setReason("");
                            }}
                          >
                            Override with reason
                          </Button>
                          {b.supplier && b.line !== null && (
                            <Link href={`/comparison?cell=${b.supplier}-${b.line}`} className="text-meta underline decoration-slate underline-offset-2 hover:decoration-ink">
                              Show in comparison
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <section aria-labelledby="memo-title" className="min-w-0 space-y-3">
          <SectionHeader
            id="memo-title"
            title="Memo for Meera"
            description="Written by Claude from computed results only; every figure links to its cell."
            actions={
              openBlockers > 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="rounded-xs">
                      {generate}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end">
                    <span className="font-semibold">
                      {openBlockers} blocker{openBlockers === 1 ? "" : "s"} to resolve first
                    </span>
                    {open.slice(0, 8).map((b) => (
                      <span key={b.key} className="block text-slate">
                        {blockerLabel(b.type)}
                        {b.supplier ? `, ${supplierNames[b.supplier]}` : ""}
                        {b.line !== null ? `, line ${b.line}` : ""}
                      </span>
                    ))}
                    {open.length > 8 && <span className="block text-slate">and {open.length - 8} more</span>}
                  </TooltipContent>
                </Tooltip>
              ) : (
                generate
              )
            }
          />

          <article aria-label="Memo preview" className="aspect-[1/1.414] rounded-xs border border-rule bg-sheet p-14 shadow-[0_1px_2px_rgb(27_42_65/0.06),0_8px_24px_rgb(27_42_65/0.06)]">
            <p className="text-meta font-semibold text-slate">Meridian Diagnostics, Procurement</p>
            <header className="mt-2 border-b-2 border-ink pb-3">
              <p className="text-title font-semibold">Award recommendation</p>
              <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-y-1 text-table">
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
                {memo.warnings.length > 0 && <p className="mb-3 rounded-xs border-l-2 border-amber bg-amber-tint px-2 py-1 text-meta text-pencil">Post-check: {memo.warnings.map((w) => `${w.text} (${w.reason})`).join("; ")}.</p>}
                <MemoBody markdown={memo.markdown} />
              </div>
            ) : (
              <p className="py-12 text-center text-body text-slate">
                {pending
                  ? "Writing the memo. This takes about 10 seconds."
                  : openBlockers
                    ? `Resolve the ${openBlockers} open blocker${openBlockers === 1 ? "" : "s"} first, then generate the memo.`
                    : "Ready. Generate the memo to see it here."}
              </p>
            )}
            <footer className="mt-8 grid grid-cols-2 gap-6 rounded-xs border border-rule-strong p-4 text-meta text-slate">
              <p>
                Approved by
                <span className="mt-8 block border-b border-slate" />
                <span className="mt-1 block">Meera, Head of Commercial Finance</span>
              </p>
              <p>
                Date
                <span className="mt-8 block border-b border-slate" />
              </p>
            </footer>
          </article>

          {memo && (
            <div className="flex flex-wrap gap-2">
              {(["pdf", "md"] as const).map((f) => (
                <Button
                  key={f}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await exportMemoAction(f);
                      if (r.ok) {
                        download(r.fileName, r.base64, r.mime);
                        toast(f === "pdf" ? "PDF exported" : "Markdown exported");
                      } else setError(r.error);
                    })
                  }
                >
                  Export {f === "pdf" ? "PDF" : "Markdown"}
                </Button>
              ))}
              <Button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await sendToNegotiationAction();
                    if (r.ok) {
                      download(r.fileName, r.base64, r.mime);
                      toast(`Sent to negotiation: ${r.count} line${r.count === 1 ? "" : "s"}`, { description: "Stubbed hand-off. Lines more than 5% above L1 or last cycle were exported and logged." });
                    } else setError(r.error);
                  })
                }
              >
                Send to negotiation ({negotiationCount} line{negotiationCount === 1 ? "" : "s"})
              </Button>
              <Button disabled={pending} onClick={() => run(convertToPoAction, (d) => String(d))}>
                Convert to PO
              </Button>
            </div>
          )}
        </section>
      </div>

      <Dialog open={!!overriding} onOpenChange={(o) => !o && !pending && setOverriding(null)}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!overriding) return;
              run(async () => {
                const r = await overrideBlockerAction(overriding.key, reason);
                if (r.ok) setOverriding(null);
                return r;
              }, "Override recorded");
            }}
          >
            <DialogHeader>
              <DialogTitle>Override with reason</DialogTitle>
              <DialogDescription>
                {overriding && (
                  <>
                    {blockerLabel(overriding.type)}
                    {overriding.supplier ? `, ${supplierNames[overriding.supplier]}` : ""}
                    {overriding.line !== null ? `, line ${overriding.line}` : ""}. {overriding.detail}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <label className="grid gap-1 text-meta text-slate">
              Reason, printed in the memo
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={OVERRIDE_MIN} rows={4} placeholder="Why the award can go ahead despite this" />
              <span>
                Recorded as your decision, with your name and the time, in the audit log.
                {reason.trim().length < OVERRIDE_MIN && ` At least ${OVERRIDE_MIN} characters.`}
              </span>
            </label>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" variant="primary" disabled={pending || reason.trim().length < OVERRIDE_MIN}>
                Override with reason
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// The memo as generated, laid out like the PDF: the Quote Freshness section shows a
// stamp beside each supplier it names.
function MemoBody({ markdown }: { markdown: string }) {
  const layout = memoLayout(markdown);
  return (
    <div className="space-y-2">
      <Markdown text={layout.before} size="doc" />
      {layout.freshness && (
        <section aria-label={layout.freshness.heading} className="space-y-2">
          <p className="border-b border-rule pt-3 pb-1 text-heading font-semibold">{layout.freshness.heading}</p>
          <ul className="space-y-2">
            {layout.freshness.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                {item.status && <Stamp status={item.status} className="shrink-0" />}
                <div className="min-w-0 flex-1 pt-0.5">
                  <Markdown text={item.text} size="doc" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {layout.after && <Markdown text={layout.after} size="doc" />}
    </div>
  );
}
