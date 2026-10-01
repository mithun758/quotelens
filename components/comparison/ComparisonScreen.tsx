"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { BasketMode } from "@/lib/comparison/build";
import { decisionReady } from "@/lib/comparison/decisionReady";
import type { ComparisonView } from "@/lib/comparison/load";
import { CiteContext, type Citer } from "../analyst/cite";
import { ViewControlContext, type ViewControl } from "../analyst/viewControl";
import { displayDate } from "../quotes/format";
import { Stamp } from "../ui/Stamp";
import { btn } from "../ui/styles";
import { Matrix } from "./Matrix";
import { SubstitutePanel } from "./SubstitutePanel";
import { SupplierPanel } from "./SupplierDrawer";

// Client-only: the conversation is restored from sessionStorage.
const AnalystPanel = dynamic(() => import("../analyst/AnalystPanel").then((m) => m.AnalystPanel), { ssr: false });

type View = "prices" | "compliance" | "freshness";
type Side = { kind: "supplier"; code: string } | { kind: "substitute"; key: string } | null;

const th = "border-b border-ink px-3 py-2 text-left text-xs font-semibold text-slate";
const td = "border-b border-rule px-3 py-2 align-top";

function QuestionnaireTable({ view }: { view: ComparisonView }) {
  return (
    <div className="overflow-x-auto border border-rule bg-sheet">
      <table className="w-full min-w-[56rem] table-fixed border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${th} w-[15rem]`}>Question</th>
            {view.suppliers.map((s) => (
              <th key={s.code} className={th}>
                {s.code}. {s.name}
                <span className={`block font-normal ${s.questionnairePassed === s.questionnaireTotal ? "text-ledger" : "text-oxblood"}`}>
                  {s.questionnairePassed} of {s.questionnaireTotal} passed
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.questions.map((q) => (
            <tr key={q.key}>
              <th scope="row" className={`${td} text-left font-normal`}>
                {q.text}
              </th>
              {view.suppliers.map((s) => {
                const a = view.answers[s.code]?.[q.key];
                const pass = a?.pass_fail === "pass";
                return (
                  <td key={s.code} className={td}>
                    <span className={`font-semibold ${pass ? "text-ledger" : "text-oxblood"}`}>{pass ? "Pass" : "Fail"}</span>
                    <span className="block text-xs text-slate">{a?.answer ?? "Not answered."}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SIGN_OFF = { pending: "Awaiting Arjun", approved: "Approved by Arjun", rejected: "Rejected by Arjun" } as const;

function ComplianceView({ view, onOpenSubstitute }: { view: ComparisonView; onOpenSubstitute: (key: string) => void }) {
  const subs = view.suppliers.flatMap((s) =>
    Object.values(view.cells[s.code] ?? {})
      .filter((c) => c.substitute_check)
      .map((c) => ({ s, c, deviations: c.substitute_check!.filter((x) => x.result === "deviates") })),
  );
  return (
    <div className="space-y-6">
      <section aria-labelledby="subs-title">
        <h2 id="subs-title" className="text-base font-semibold">
          Substitute models
        </h2>
        <p className="text-xs text-slate">Offered in place of the specified model. A substitute that deviates on any attribute counts only after Arjun approves it.</p>
        {subs.length === 0 ? (
          <p className="mt-2 border-y border-rule py-4 text-sm text-slate">No supplier offered a substitute model.</p>
        ) : (
          <table className="mt-2 w-full border-collapse border border-rule bg-sheet text-[13px]">
            <thead>
              <tr>
                <th className={th}>Supplier</th>
                <th className={th}>Line</th>
                <th className={th}>Offered</th>
                <th className={th}>Attribute check</th>
                <th className={th}>Sign-off</th>
                <th className={th}>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {subs.map(({ s, c, deviations }) => (
                <tr key={c.id}>
                  <td className={`${td} whitespace-nowrap`}>
                    {s.code}. {s.name}
                  </td>
                  <td className={td}>
                    {c.line_no}. {c.description}
                  </td>
                  <td className={`${td} max-w-[18rem] text-xs`}>“{c.source_snippet}”</td>
                  <td className={td}>
                    {deviations.length ? (
                      <span className="font-semibold text-oxblood">Deviates on {deviations.map((d) => d.attribute.replace(/_/g, " ")).join(", ")}</span>
                    ) : (
                      <span className="text-ledger">Meets every attribute</span>
                    )}
                  </td>
                  <td
                    className={`${td} whitespace-nowrap ${c.substitute_status === "approved" ? "text-ledger" : c.substitute_status === "rejected" ? "text-oxblood" : c.substitute_status === "pending" ? "font-semibold" : "text-slate"}`}
                  >
                    {c.substitute_status ? SIGN_OFF[c.substitute_status] : "Not needed"}
                  </td>
                  <td className={`${td} text-right`}>
                    {c.substitute_status !== null && (
                      <button type="button" onClick={() => onOpenSubstitute(`${s.code}:${c.line_no}`)} className={`${btn.small} whitespace-nowrap`}>
                        {c.substitute_status === "pending" ? "Review substitute" : "View sign-off"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section aria-labelledby="q-title" className="space-y-2">
        <div>
          <h2 id="q-title" className="text-base font-semibold">
            Quality questionnaire
          </h2>
          <p className="text-xs text-slate">A supplier is qualified only when it passes every question.</p>
        </div>
        <QuestionnaireTable view={view} />
      </section>
    </div>
  );
}

function FreshnessView({ view, onOpenSupplier }: { view: ComparisonView; onOpenSupplier: (code: string) => void }) {
  return (
    <section aria-labelledby="fresh-title" className="space-y-2">
      <div>
        <h2 id="fresh-title" className="text-base font-semibold">
          Quote Freshness
        </h2>
        <p className="text-xs text-slate">Can Priya still rely on each quote? Checked as of the as-of date, with {view.approvalDays} days for approval. Benchmarks and FX are illustrative.</p>
      </div>
      <table className="w-full border-collapse border border-rule bg-sheet text-[13px]">
        <thead>
          <tr>
            <th className={`${th} w-[14rem]`}>Supplier</th>
            <th className={`${th} w-[8.5rem]`}>Quote date</th>
            <th className={`${th} w-[8.5rem]`}>Valid until</th>
            <th className={th}>Rules fired</th>
          </tr>
        </thead>
        <tbody>
          {view.suppliers.map((s) => {
            const f = view.freshness[s.code];
            const t = view.terms[s.code];
            const fired = f?.rules.filter((r) => r.fired) ?? [];
            return (
              <tr key={s.code}>
                <td className={td}>
                  <button type="button" onClick={() => onOpenSupplier(s.code)} className="text-left font-semibold underline decoration-rule underline-offset-4 hover:decoration-ink">
                    {s.code}. {s.name}
                  </button>
                  <span className="mt-1 block">{f ? <Stamp status={f.status} /> : <span className="text-xs text-slate">Not extracted</span>}</span>
                </td>
                <td className={td}>{displayDate(t?.quoteDate) || <span className="text-slate">Not stated</span>}</td>
                <td className={td}>{displayDate(t?.validUntil) || <span className="text-slate">Not stated</span>}</td>
                <td className={td}>
                  {fired.length === 0 ? (
                    <span className="text-ledger">None fired. Safe to act on.</span>
                  ) : (
                    <ul className="space-y-2">
                      {fired.map((r) => (
                        <li key={r.key} className={`border-l-[3px] pl-2 ${r.severity === "high" ? "border-oxblood" : "border-amber"}`}>
                          <span className="font-semibold">{r.label}</span>{" "}
                          <span className={`text-xs ${r.severity === "high" ? "text-oxblood" : "text-pencil"}`}>{r.severity === "high" ? "High" : "Medium"}</span>
                          <span className="block text-xs text-slate">{r.reason}</span>
                          <span className="block text-xs">Recommended: {r.action}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate">
      <span>
        <span className="font-semibold text-ink">63,900</span> Extracted
      </span>
      <span>
        <span className="val-inferred">71,400</span> Inferred
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="val-missing inline-block h-3 w-8 align-middle" /> Not quoted
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-[3px] bg-ledger" /> L1
      </span>
      <span>
        <span className="rounded-xs border border-field px-1">sub</span> substitute, not counted until signed off
      </span>
      <span>
        <span className="text-pencil">⚑</span> open flag
      </span>
      <span>Hover a price for its source; click to keep it open</span>
    </p>
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

export function ComparisonScreen({ view, focusCell = null }: { view: ComparisonView; focusCell?: string | null }) {
  const params = useSearchParams();
  const raw = params.get("view") ?? "prices";
  const decision = raw === "decision";
  const tab: View = raw === "compliance" || raw === "freshness" ? raw : "prices";
  const analystOpen = params.get("analyst") === "1";
  const [mode, setMode] = useState<BasketMode>("common");
  const [side, setSide] = useState<Side>(null);
  const [highlight, setHighlight] = useState<{ key: string; n: number } | null>(focusCell ? { key: focusCell, n: 0 } : null);

  const ready = useMemo(() => decisionReady(view), [view]);
  const excluded = useMemo(() => (decision ? Object.fromEntries(ready.excluded.map((e) => [e.code, e.reasons])) : {}), [decision, ready]);
  const result = decision ? ready.result : view.result;

  const openSide = (next: Side) => {
    setSide(next);
    setParams({ analyst: null });
  };
  const closeAll = useCallback(() => {
    setSide(null);
    setParams({ analyst: null });
  }, []);
  const openAnalyst = () => {
    setSide(null);
    setParams({ analyst: "1" });
  };

  // A unit price cited by the analyst links to its cell (see analyst/cite).
  const citer = useMemo<Citer>(() => {
    const index = new Map<number, string[]>();
    for (const [code, byLine] of Object.entries(view.cells)) {
      for (const [line, c] of Object.entries(byLine)) {
        if (c.normalised_value_inr === null) continue;
        const k = Math.round(c.normalised_value_inr * 100);
        index.set(k, [...(index.get(k) ?? []), `${code}:${line}`]);
      }
    }
    return {
      keyFor: (v, lines) => {
        const keys = (index.get(Math.round(v * 100)) ?? []).filter((k) => lines.includes(Number(k.split(":")[1])));
        return keys.length === 1 ? keys[0] : null;
      },
      cite: (key) => {
        setParams({ view: decision ? "decision" : "prices" });
        setHighlight((h) => ({ key, n: (h?.n ?? 0) + 1 }));
      },
    };
  }, [view.cells, decision]);

  // set_view from the analyst: change the view, Quoted or Decision-ready, and the basket.
  const viewControl = useMemo<ViewControl>(
    () => ({
      apply: (v) => {
        const base = v.view ?? tab;
        const quotes = v.quotes ?? (decision ? "decision_ready" : "quoted");
        setParams({ view: base === "prices" ? (quotes === "decision_ready" ? "decision" : "prices") : base });
        if (v.basket) setMode(v.basket);
        return [
          base === "prices" ? (quotes === "decision_ready" ? "Prices, Decision-ready" : "Prices, Quoted") : base === "compliance" ? "Compliance" : "Quote Freshness",
          v.basket && (v.basket === "common" ? "common basket" : "all lines"),
        ]
          .filter(Boolean)
          .join(", ");
      },
    }),
    [tab, decision],
  );

  const subCell =
    side?.kind === "substitute"
      ? (() => {
          const [code, line] = side.key.split(":");
          const cell = view.cells[code]?.[Number(line)];
          const l = view.lines.find((x) => x.line_no === Number(line));
          const s = view.suppliers.find((x) => x.code === code);
          return cell && l && s ? { cell, label: `line ${l.line_no}: ${l.description}`, name: `${s.code}. ${s.name}` } : null;
        })()
      : null;
  const panelOpen = analystOpen || !!side;

  const tabs: [View, string][] = [
    ["prices", "Prices"],
    ["compliance", "Compliance"],
    ["freshness", "Quote Freshness"],
  ];
  const names = Object.fromEntries(view.suppliers.map((s) => [s.code, s.name]));

  return (
    <CiteContext.Provider value={citer}>
      <ViewControlContext.Provider value={viewControl}>
      <div className={`grid gap-5 ${panelOpen ? "grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_460px]" : "grid-cols-1"}`}>
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Quote Comparison</h1>
              <p className="text-sm text-slate">INR per piece, ex-GST, delivered to hub</p>
            </div>
            {!analystOpen && (
              <button type="button" onClick={openAnalyst} className={btn.primary}>
                Ask the analyst
              </button>
            )}
          </div>

          <div role="tablist" aria-label="Comparison views" className="flex gap-5 border-b border-rule">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                type="button"
                onClick={() => setParams({ view: key })}
                className={`-mb-px border-b-2 pb-2 text-sm ${tab === key ? "border-ink font-semibold" : "border-transparent text-slate hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "prices" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <fieldset className="flex rounded-xs border border-field text-sm">
                  <legend className="sr-only">Which quotes to count</legend>
                  {(
                    [
                      [false, "Quoted"],
                      [true, "Decision-ready"],
                    ] as const
                  ).map(([d, label]) => (
                    <label key={label} className={`cursor-pointer px-3 py-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${decision === d ? "bg-ink font-semibold text-white" : "bg-sheet hover:bg-tint"}`}>
                      <input type="radio" name="quotes" className="sr-only" checked={decision === d} onChange={() => setParams({ view: d ? "decision" : "prices" })} />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <fieldset className="flex rounded-xs border border-field text-xs">
                  <legend className="sr-only">Basket</legend>
                  {(
                    [
                      ["common", `Common basket, ${result.commonBasket.length} lines`],
                      ["all", `All ${view.lines.length} lines, gaps priced`],
                    ] as const
                  ).map(([m, label]) => (
                    <label key={m} className={`cursor-pointer px-2.5 py-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${mode === m ? "bg-ink font-semibold text-white" : "bg-sheet hover:bg-tint"}`}>
                      <input type="radio" name="mode" className="sr-only" checked={mode === m} onChange={() => setMode(m)} />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </div>
              <p aria-live="polite" className={`border-l-[3px] px-3 py-1.5 text-xs ${decision ? "border-ink bg-tint" : "border-rule text-slate"}`}>
                {decision ? (
                  <>
                    <span className="font-semibold">Decision-ready: </span>
                    {ready.included.length ? `counting ${ready.included.map((c) => `${c}. ${names[c]}`).join(", ")}. ` : "no supplier qualifies. "}
                    {ready.excluded.length > 0 && `Excluded ${ready.excluded.map((e) => `${e.code} (${e.reasons.join("; ")})`).join(", ")}. `}
                    Substitutes count only once Arjun approves them.
                  </>
                ) : (
                  "Quoted: every supplier's counted price. Substitutes count only once Arjun approves them."
                )}
              </p>
              <Legend />
              {mode === "all" && (
                <p className="border-l-[3px] border-amber bg-amber-tint px-3 py-1.5 text-xs text-pencil">
                  Each gap is priced at the lowest other supplier&apos;s quote so every supplier can be compared on the full RFx. Gap prices are not quotes and are labelled in the cell.
                </p>
              )}
              <Matrix
                view={view}
                result={result}
                excluded={excluded}
                mode={mode}
                onOpenSupplier={(code) => openSide({ kind: "supplier", code })}
                onOpenSubstitute={(key) => openSide({ kind: "substitute", key })}
                highlight={highlight}
              />
            </>
          )}
          {tab === "compliance" && <ComplianceView view={view} onOpenSubstitute={(key) => openSide({ kind: "substitute", key })} />}
          {tab === "freshness" && <FreshnessView view={view} onOpenSupplier={(code) => openSide({ kind: "supplier", code })} />}
        </section>

        {analystOpen && !side && <AnalystPanel onClose={closeAll} />}
        {side?.kind === "supplier" && <SupplierPanel view={view} code={side.code} mode={mode} onClose={closeAll} />}
        {side?.kind === "substitute" && subCell && <SubstitutePanel cell={subCell.cell} supplierName={subCell.name} lineLabel={subCell.label} onClose={closeAll} />}
      </div>
      </ViewControlContext.Provider>
    </CiteContext.Provider>
  );
}
