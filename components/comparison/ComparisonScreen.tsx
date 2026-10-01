"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { BasketMode } from "@/lib/comparison/build";
import type { ComparisonView } from "@/lib/comparison/load";
import { CiteContext, type Citer } from "../analyst/cite";
import { FormatIcon } from "../quotes/FormatIcon";
import { btn } from "../ui/styles";
import { Matrix } from "./Matrix";
import { SubstitutePanel } from "./SubstitutePanel";
import { SupplierPanel } from "./SupplierDrawer";

// Client-only: the conversation is restored from sessionStorage.
const AnalystPanel = dynamic(() => import("../analyst/AnalystPanel").then((m) => m.AnalystPanel), { ssr: false });

type Tab = "matrix" | "questionnaire" | "documents";
type Side = { kind: "analyst" } | { kind: "supplier"; code: string } | { kind: "substitute"; key: string } | null;

function QuestionnaireTab({ view }: { view: ComparisonView }) {
  return (
    <div className="overflow-x-auto rounded-xs border border-rule bg-sheet">
      <table className="w-full min-w-[900px] border-collapse text-[13px]">
        <thead>
          <tr className="text-xs text-slate">
            <th className="border-b border-ink px-3 py-2 text-left font-semibold">Question</th>
            {view.suppliers.map((s) => (
              <th key={s.code} className="border-b border-ink px-3 py-2 text-left font-semibold">
                {s.code}. {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.questions.map((q) => (
            <tr key={q.key} className="align-top">
              <th scope="row" className="max-w-[16rem] border-b border-rule px-3 py-2 text-left font-normal">
                {q.text}
              </th>
              {view.suppliers.map((s) => {
                const a = view.answers[s.code]?.[q.key];
                const pass = a?.pass_fail === "pass";
                return (
                  <td key={s.code} className="border-b border-rule px-3 py-2">
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

function DocumentsTab({ view }: { view: ComparisonView }) {
  return (
    <table className="w-full max-w-3xl border-collapse text-[13px]">
      <thead>
        <tr className="text-xs text-slate">
          <th className="border-b border-ink py-2 pr-3 text-left font-semibold">Supplier</th>
          <th className="border-b border-ink py-2 text-left font-semibold">Documents</th>
        </tr>
      </thead>
      <tbody>
        {view.suppliers.map((s) => (
          <tr key={s.code} className="align-top">
            <th scope="row" className="border-b border-rule py-2 pr-3 text-left font-semibold">
              {s.code}. {s.name}
            </th>
            <td className="border-b border-rule py-2">
              <ul className="space-y-1">
                {s.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <FormatIcon format={d.format} />
                    <Link href={`/quotes?supplier=${s.code}`} className="truncate underline decoration-rule underline-offset-4 hover:decoration-ink" title={d.file_name}>
                      {d.file_name}
                    </Link>
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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

export function ComparisonScreen({ view, focusCell = null }: { view: ComparisonView; focusCell?: string | null }) {
  const [tab, setTab] = useState<Tab>("matrix");
  const [mode, setMode] = useState<BasketMode>("common");
  const [side, setSide] = useState<Side>(null);
  const [highlight, setHighlight] = useState<{ key: string; n: number } | null>(focusCell ? { key: focusCell, n: 0 } : null);
  const close = useCallback(() => setSide(null), []);

  // A unit price cited by the analyst links to its cell when exactly one cell has it.
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
        setTab("matrix");
        setHighlight((h) => ({ key, n: (h?.n ?? 0) + 1 }));
      },
    };
  }, [view.cells]);

  const subCell = side?.kind === "substitute" ? (() => {
    const [code, line] = side.key.split(":");
    const cell = view.cells[code]?.[Number(line)];
    const l = view.lines.find((x) => x.line_no === Number(line));
    const s = view.suppliers.find((x) => x.code === code);
    return cell && l && s ? { cell, label: `line ${l.line_no}: ${l.description}`, name: `${s.code}. ${s.name}` } : null;
  })() : null;

  const tabs: [Tab, string][] = [
    ["matrix", "Prices"],
    ["questionnaire", "Questionnaire answers"],
    ["documents", "Documents"],
  ];

  return (
    <CiteContext.Provider value={citer}>
      <div className={`grid gap-5 ${side ? "grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_460px]" : "grid-cols-1"}`}>
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Quote Comparison</h1>
              <p className="text-sm text-slate">INR per piece, ex-GST, delivered to hub</p>
            </div>
            {side?.kind !== "analyst" && (
              <button type="button" onClick={() => setSide({ kind: "analyst" })} className={btn.primary}>
                Ask the analyst
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-rule">
            <div role="tablist" aria-label="Comparison views" className="flex gap-5">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`-mb-px border-b-2 pb-2 text-sm ${tab === key ? "border-ink font-semibold" : "border-transparent text-slate hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "matrix" && (
              <fieldset className="mb-1.5 flex rounded-xs border border-field text-xs">
                <legend className="sr-only">Basket</legend>
                {(
                  [
                    ["common", `Common basket, ${view.result.commonBasket.length} lines`],
                    ["all", `All ${view.lines.length} lines, gaps priced`],
                  ] as const
                ).map(([m, label]) => (
                  <label key={m} className={`cursor-pointer px-2.5 py-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${mode === m ? "bg-ink font-semibold text-white" : "bg-sheet hover:bg-tint"}`}>
                    <input type="radio" name="mode" className="sr-only" checked={mode === m} onChange={() => setMode(m)} />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
          </div>

          {tab === "matrix" && (
            <>
              <Legend />
              {mode === "all" && (
                <p className="border-l-[3px] border-amber bg-amber-tint px-3 py-1.5 text-xs text-pencil">
                  Each gap is priced at the lowest other supplier&apos;s quote so every supplier can be compared on the full RFx. Gap prices are not quotes and are labelled in the cell.
                </p>
              )}
              <Matrix
                view={view}
                mode={mode}
                onOpenSupplier={(code) => setSide({ kind: "supplier", code })}
                onOpenSubstitute={(key) => setSide({ kind: "substitute", key })}
                highlight={highlight}
              />
            </>
          )}
          {tab === "questionnaire" && <QuestionnaireTab view={view} />}
          {tab === "documents" && <DocumentsTab view={view} />}
        </section>

        {side?.kind === "analyst" && <AnalystPanel onClose={close} />}
        {side?.kind === "supplier" && <SupplierPanel view={view} code={side.code} mode={mode} onClose={close} />}
        {side?.kind === "substitute" && subCell && <SubstitutePanel cell={subCell.cell} supplierName={subCell.name} lineLabel={subCell.label} onClose={close} />}
      </div>
    </CiteContext.Provider>
  );
}
