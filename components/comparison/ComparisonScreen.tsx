"use client";

import { Check, Minus, Paperclip, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { BasketMode } from "@/lib/comparison/build";
import { decisionReady } from "@/lib/comparison/decisionReady";
import { filterSuppliers, type SupplierFilter } from "@/lib/comparison/filter";
import type { ComparisonView } from "@/lib/comparison/load";
import type { SubstituteCheck } from "@/lib/db/types";
import { daysAfterApproval } from "@/lib/freshness/margin";
import { cn } from "@/lib/utils";
import { useLens, useLensScreen } from "../lens/LensProvider";
import { displayDate } from "../quotes/format";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Stamp } from "../ui/Stamp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { FreshnessRules } from "./FreshnessRules";
import { Legend, Matrix } from "./Matrix";
import { SubstitutePanel } from "./SubstitutePanel";
import { SupplierPanel } from "./SupplierDrawer";

type View = "prices" | "compliance" | "freshness";

const th = "border-b-2 border-rule-strong bg-sheet px-3 py-2 text-left align-bottom text-meta font-semibold text-slate";
const td = "border-b border-rule px-3 py-2 align-top";

// A substitute's attribute verdict: ledger check, amber minus, oxblood cross, always with words.
function Verdict({ c }: { c: SubstituteCheck[number] }) {
  const notStated = c.offered === null;
  const tone = notStated ? "text-pencil" : c.result === "deviates" ? "text-oxblood" : "text-ledger";
  const Icon = notStated ? Minus : c.result === "deviates" ? X : Check;
  const word = notStated ? "not stated" : c.result;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("inline-flex items-center gap-1 rounded-xs border border-rule px-1.5 text-meta", tone)}>
          <Icon aria-hidden className="size-3.5 stroke-[1.5]" />
          <span className="text-ink">{c.attribute.replace(/_/g, " ")}</span>
          <span className="sr-only">: {word}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-semibold capitalize">{word}.</span> Required {String(c.required)}, offered {c.offered === null ? "nothing stated" : String(c.offered)}.
      </TooltipContent>
    </Tooltip>
  );
}

const SIGN_OFF = { pending: "Awaiting Arjun", approved: "Approved by Arjun", rejected: "Rejected by Arjun" } as const;

function ComplianceView({ view, onOpenSubstitute }: { view: ComparisonView; onOpenSubstitute: (key: string) => void }) {
  const subs = view.suppliers.flatMap((s) =>
    Object.values(view.cells[s.code] ?? {})
      .filter((c) => c.substitute_check)
      .map((c) => ({ s, c })),
  );
  return (
    <div className="space-y-8">
      <section aria-labelledby="subs-title" className="space-y-3">
        <div>
          <h2 id="subs-title" className="text-heading font-semibold">
            Substitute models
          </h2>
          <p className="text-meta text-slate">Offered in place of the specified model. A substitute that deviates on any attribute counts only after Arjun approves it.</p>
        </div>
        {subs.length === 0 ? (
          <p className="border-y border-rule py-4 text-body text-slate">No supplier offered a substitute model.</p>
        ) : (
          <div className="overflow-x-auto rounded-xs border border-rule bg-sheet">
            <table className="w-full min-w-[56rem] border-collapse text-table">
              <thead>
                <tr>
                  <th className={th}>Line</th>
                  <th className={th}>Supplier</th>
                  <th className={th}>Offered</th>
                  <th className={th}>Attributes against the specification</th>
                  <th className={th}>Sign-off</th>
                  <th className={th}>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {subs.map(({ s, c }) => (
                  <tr key={c.id} className="hover:bg-tint">
                    <td className={td}>
                      <span className="text-slate">{c.line_no}</span> {c.description}
                    </td>
                    <td className={cn(td, "whitespace-nowrap")}>
                      <span className="text-slate">{s.code}</span> {s.name}
                    </td>
                    <td className={cn(td, "max-w-[16rem] text-meta")}>“{c.source_snippet}”</td>
                    <td className={td}>
                      <span className="flex flex-wrap gap-1">
                        {c.substitute_check!.map((x) => (
                          <Verdict key={x.attribute} c={x} />
                        ))}
                      </span>
                    </td>
                    <td className={cn(td, "whitespace-nowrap", c.substitute_status === "approved" ? "text-ledger" : c.substitute_status === "rejected" ? "text-oxblood" : c.substitute_status === "pending" ? "font-semibold" : "text-slate")}>
                      {c.substitute_status ? SIGN_OFF[c.substitute_status] : "Not needed"}
                    </td>
                    <td className={cn(td, "text-right")}>
                      {c.substitute_status !== null && (
                        <Button size="sm" variant={c.substitute_status === "pending" ? "primary" : "outline"} onClick={() => onOpenSubstitute(`${s.code}:${c.line_no}`)}>
                          {c.substitute_status === "pending" ? "Review substitute" : "View sign-off"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="q-title" className="space-y-3">
        <div>
          <h2 id="q-title" className="text-heading font-semibold">
            Quality questionnaire
          </h2>
          <p className="text-meta text-slate">A supplier is qualified only when it passes every question. Hover a result for the supplier&apos;s answer; the paperclip opens its evidence.</p>
        </div>
        <div className="overflow-x-auto rounded-xs border border-rule bg-sheet">
          <table className="w-full min-w-[48rem] table-fixed border-collapse text-table">
            <thead>
              <tr>
                <th className={cn(th, "w-[18rem]")}>Question</th>
                {view.suppliers.map((s) => {
                  const passed = s.questionnairePassed === s.questionnaireTotal;
                  return (
                    <th key={s.code} className={cn(th, "text-right")}>
                      <span className="block text-table font-semibold text-ink">
                        <span className="text-slate">{s.code}</span> {s.name}
                      </span>
                      <Badge variant={passed ? "ledger" : "oxblood"} className="mt-1 font-semibold">
                        {s.questionnairePassed} of {s.questionnaireTotal} passed
                      </Badge>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {view.questions.map((q, i) => (
                <tr key={q.key} className="hover:bg-tint">
                  <th scope="row" className={cn(td, "text-left font-normal")}>
                    <span className="mr-2 text-slate">{i + 1}</span>
                    {q.text}
                  </th>
                  {view.suppliers.map((s) => {
                    const a = view.answers[s.code]?.[q.key];
                    const result = a?.pass_fail ?? null;
                    const Icon = result === "pass" ? Check : result === "fail" ? X : Minus;
                    return (
                      <td key={s.code} className={cn(td, "text-right")}>
                        <span className="inline-flex items-center gap-1">
                          {a?.evidence_document_id && (
                            <Link
                              href={`/quotes?doc=${a.evidence_document_id}#exceptions`}
                              aria-label={`Evidence from ${s.name} for question ${i + 1}`}
                              title="Open the evidence document"
                              className="inline-flex size-6 items-center justify-center rounded-xs text-slate hover:bg-tint hover:text-ink"
                            >
                              <Paperclip aria-hidden className="size-3.5 stroke-[1.5]" />
                            </Link>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0} className={cn("inline-flex items-center gap-1 font-semibold", result === "pass" ? "text-ledger" : result === "fail" ? "text-oxblood" : "text-slate")}>
                                <Icon aria-hidden className="size-3.5 stroke-[1.5]" />
                                {result === "pass" ? "Pass" : result === "fail" ? "Fail" : "No answer"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{a?.answer ?? "Not answered."}</TooltipContent>
                          </Tooltip>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FreshnessView({
  view,
  asOf,
  onOpenSupplier,
  onOpenRules,
  onReconfirm,
}: {
  view: ComparisonView;
  asOf: string;
  onOpenSupplier: (code: string) => void;
  onOpenRules: (code: string) => void;
  onReconfirm: (name: string) => void;
}) {
  return (
    <section aria-labelledby="fresh-title" className="space-y-3">
      <div>
        <h2 id="fresh-title" className="text-heading font-semibold">
          Quote Freshness
        </h2>
        <p className="text-meta text-slate">
          Can Priya still rely on each quote? Checked as of {displayDate(asOf)}, with {view.approvalDays} days for approval. Benchmarks and FX are illustrative.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xs border border-rule bg-sheet">
        <table className="w-full min-w-[52rem] border-collapse text-table">
          <thead>
            <tr>
              <th className={cn(th, "w-[15rem]")}>Supplier</th>
              <th className={cn(th, "w-28")}>Quote date</th>
              <th className={cn(th, "w-28")}>Valid until</th>
              <th className={cn(th, "w-28 text-right")}>Days after approval</th>
              <th className={th}>Rules fired</th>
              <th className={th}>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {view.suppliers.map((s) => {
              const f = view.freshness[s.code];
              const t = view.terms[s.code];
              const fired = f?.rules.filter((r) => r.fired) ?? [];
              const margin = daysAfterApproval(t?.validUntil, asOf, view.approvalDays);
              return (
                <tr key={s.code} className="hover:bg-tint">
                  <td className={td}>
                    <span className="flex items-center justify-between gap-2">
                      <button type="button" onClick={() => onOpenSupplier(s.code)} className="text-left font-semibold underline decoration-rule underline-offset-4 hover:decoration-ink">
                        <span className="font-normal text-slate">{s.code}</span> {s.name}
                      </button>
                      {f ? <Stamp status={f.status} onClick={() => onOpenRules(s.code)} /> : <span className="text-meta text-slate">Not extracted</span>}
                    </span>
                  </td>
                  <td className={td}>{displayDate(t?.quoteDate) || <span className="text-slate">Not stated</span>}</td>
                  <td className={td}>{displayDate(t?.validUntil) || <span className="text-slate">Not stated</span>}</td>
                  <td className={cn(td, "text-right")}>
                    {margin === null ? <span className="text-slate">No validity</span> : <span className={margin < 0 ? "font-semibold text-oxblood" : ""}>{margin < 0 ? `−${Math.abs(margin)}` : margin}</span>}
                  </td>
                  <td className={td}>
                    {fired.length === 0 ? (
                      <span className="text-ledger">None fired</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {fired.map((r) => (
                          <Tooltip key={r.key}>
                            <TooltipTrigger asChild>
                              <button type="button" onClick={() => onOpenRules(s.code)}>
                                <Badge variant={r.severity === "high" ? "oxblood" : "pencil"}>
                                  <span className="font-semibold">{f!.rules.indexOf(r) + 1}</span> {r.label}
                                  <span className="sr-only">, {r.severity === "high" ? "high" : "medium"}</span>
                                </Badge>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {r.reason}
                              <span className="mt-1 block text-slate">Recommended: {r.action}</span>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className={cn(td, "text-right")}>
                    {f && f.status !== "Fresh" && (
                      <Button size="sm" variant="outline" onClick={() => onReconfirm(s.name)}>
                        Ask Lens to reconfirm
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Keeps the view in the URL without a server round trip, so the step rail can follow it.
function setParams(patch: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  url.searchParams.delete("cell");
  window.history.replaceState(null, "", url);
}

const FILTERS: [SupplierFilter, string][] = [
  ["all", "All suppliers"],
  ["qualified", "Qualified"],
  ["not_stale", "Not stale"],
];

export function ComparisonScreen({ view, asOf, focusCell = null, focusLine = null }: { view: ComparisonView; asOf: string; focusCell?: string | null; focusLine?: number | null }) {
  const params = useSearchParams();
  const raw = params.get("view") ?? "prices";
  const decision = raw === "decision";
  const tab: View = raw === "compliance" || raw === "freshness" ? raw : "prices";
  const [mode, setMode] = useState<BasketMode>("common");
  const [filter, setFilter] = useState<SupplierFilter>("all");
  const [highlight, setHighlight] = useState<{ key: string; n: number } | null>(focusCell ? { key: focusCell, n: 0 } : null);
  const [opened, setOpened] = useState<string | null>(null);
  const { setOpen: setDockOpen, ask, openSheet, closeSheet, sheet } = useLens();

  const ready = useMemo(() => decisionReady(view), [view]);
  const filtered = useMemo(() => filterSuppliers(view, filter), [view, filter]);
  const shown = decision ? ready : filter !== "all" ? filtered : null;
  const excluded = useMemo(() => Object.fromEntries((shown?.excluded ?? []).map((e) => [e.code, e.reasons])), [shown]);
  const result = shown ? shown.result : view.result;
  const names = Object.fromEntries(view.suppliers.map((s) => [s.code, s.name]));
  const share = result.lastCycleAllLines ? Math.round((result.lastCycleCommonBasket / result.lastCycleAllLines) * 100) : null;

  // Supplier details, freshness rules and Arjun's substitute sign-off open in the Lens dock as a sheet.
  const openSupplier = (code: string) => {
    setOpened(`supplier panel open for ${code}`);
    openSheet({ key: `supplier:${code}`, render: () => <SupplierPanel view={view} code={code} mode={mode} onClose={closeSheet} /> });
  };
  const reconfirm = (name: string) => {
    closeSheet();
    setDockOpen(true);
    ask(`Ask ${name} to reconfirm its prices.`);
  };
  const openRules = (code: string) => {
    const s = view.suppliers.find((x) => x.code === code);
    const f = view.freshness[code];
    if (!s || !f) return;
    setOpened(`Quote Freshness rules open for ${code}`);
    openSheet({
      key: `rules:${code}`,
      render: () => (
        <FreshnessRules supplierName={`${s.code}. ${s.name}`} freshness={f} quoteDate={view.terms[code]?.quoteDate ?? null} validUntil={view.terms[code]?.validUntil ?? null} onClose={closeSheet} onReconfirm={() => reconfirm(s.name)} />
      ),
    });
  };
  const openSubstitute = (key: string) => {
    const [code, line] = key.split(":");
    const cell = view.cells[code]?.[Number(line)];
    const l = view.lines.find((x) => x.line_no === Number(line));
    const s = view.suppliers.find((x) => x.code === code);
    if (!cell || !l || !s) return;
    setOpened(`substitute sign-off open for supplier ${code}, line ${line}`);
    openSheet({ key: `substitute:${key}`, render: () => <SubstitutePanel cell={cell} supplierName={`${s.code}. ${s.name}`} lineLabel={`line ${l.line_no}: ${l.description}`} onClose={closeSheet} /> });
  };

  // What Lens is told Priya is looking at.
  const selection = [
    `view ${tab === "prices" ? `Prices, ${decision ? "Decision-ready" : "Quoted"}, ${mode === "common" ? "common basket" : "all lines"}${!decision && filter !== "all" ? `, filtered to ${filter === "qualified" ? "qualified suppliers" : "quotes that are not Stale"}` : ""}` : tab === "compliance" ? "Compliance" : "Quote Freshness"}`,
    sheet && opened,
    highlight && `highlighted cell supplier ${highlight.key.split(":")[0]}, line ${highlight.key.split(":")[1]}`,
  ]
    .filter(Boolean)
    .join("; ");

  // Lens cites a cell as [[cell:B:17]]: clicking it scrolls to the cell and highlights it.
  // set_view from Lens switches the view, Quoted or Decision-ready, and the basket.
  useLensScreen({
    selection,
    cite: (key) => {
      setParams({ view: decision ? "decision" : "prices" });
      setHighlight((h) => ({ key, n: (h?.n ?? 0) + 1 }));
    },
    applyView: (v) => {
      const base = v.view ?? tab;
      const quotes = v.quotes ?? (decision ? "decision_ready" : "quoted");
      setParams({ view: base === "prices" ? (quotes === "decision_ready" ? "decision" : "prices") : base });
      if (v.basket) setMode(v.basket);
      return [base === "prices" ? (quotes === "decision_ready" ? "Prices, Decision-ready" : "Prices, Quoted") : base === "compliance" ? "Compliance" : "Quote Freshness", v.basket && (v.basket === "common" ? "common basket" : "all lines")]
        .filter(Boolean)
        .join(", ");
    },
  });

  const basis =
    mode === "common"
      ? `Common basket: ${result.commonBasket.length} lines${share !== null ? `, ${share}% of last cycle's spend` : ""}.`
      : `All ${view.lines.length} lines. A gap is priced at the lowest other supplier's quote and labelled in the cell; it is not a quote.`;
  const scope = decision
    ? ready.included.length
      ? `Decision-ready: counting ${ready.included.map((c) => names[c]).join(", ")}. Stale quotes and suppliers failing the questionnaire are excluded.`
      : "Decision-ready: no supplier qualifies yet."
    : filter === "qualified"
      ? "Suppliers failing the questionnaire are excluded."
      : filter === "not_stale"
        ? "Stale quotes are excluded."
        : "Every supplier's counted price.";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title font-semibold">Quote Comparison</h1>
          <p className="text-body text-slate">INR per piece, ex-GST, delivered to hub</p>
        </div>
        {tab === "prices" && (
          <ToggleGroup
            type="single"
            aria-label="Which quotes to count"
            value={decision ? "decision" : "quoted"}
            onValueChange={(v) => v && setParams({ view: v === "decision" ? "decision" : "prices" })}
          >
            <ToggleGroupItem value="quoted">Quoted</ToggleGroupItem>
            <ToggleGroupItem value="decision">Decision-ready</ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ view: v === "prices" && decision ? "decision" : v })}>
        <TabsList aria-label="Comparison views">
          <TabsTrigger value="prices">Prices</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="freshness">Freshness</TabsTrigger>
        </TabsList>

        <TabsContent value="prices" className="space-y-3 pt-4">
          <p aria-live="polite" className="text-meta text-slate">
            <span className="font-semibold text-ink">{basis}</span> {scope} Substitutes count only once Arjun approves them.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {decision ? (
              <p className="text-meta text-slate">Decision-ready applies both filters.</p>
            ) : (
              <ToggleGroup type="single" size="sm" aria-label="Which suppliers to count" value={filter} onValueChange={(v) => v && setFilter(v as SupplierFilter)}>
                {FILTERS.map(([v, label]) => (
                  <ToggleGroupItem key={v} value={v}>
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
            <ToggleGroup type="single" size="sm" aria-label="Basket" value={mode} onValueChange={(v) => v && setMode(v as BasketMode)}>
              <ToggleGroupItem value="common">Common basket, {result.commonBasket.length} lines</ToggleGroupItem>
              <ToggleGroupItem value="all">All {view.lines.length} lines, gaps priced</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Legend />
          <Matrix
            view={view}
            result={result}
            excluded={excluded}
            mode={mode}
            onOpenSupplier={openSupplier}
            onOpenRules={openRules}
            onOpenSubstitute={openSubstitute}
            highlight={highlight}
            focusLine={focusLine}
          />
        </TabsContent>
        <TabsContent value="compliance" className="pt-4">
          <ComplianceView view={view} onOpenSubstitute={openSubstitute} />
        </TabsContent>
        <TabsContent value="freshness" className="pt-4">
          <FreshnessView view={view} asOf={asOf} onOpenSupplier={openSupplier} onOpenRules={openRules} onReconfirm={reconfirm} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
