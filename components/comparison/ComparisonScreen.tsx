"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cheapest, totalFor, type BasketMode } from "@/lib/comparison/build";
import type { ComparisonView } from "@/lib/comparison/load";
import { formatInr, formatInrCompact } from "@/lib/format/inr";
import { FormatIcon } from "../quotes/FormatIcon";
import { CellCard } from "./CellCard";

type Tab = "matrix" | "questionnaire" | "documents";

const BADGE = {
  extracted: { label: "E", style: "bg-zinc-100 text-zinc-600", title: "Extracted" },
  inferred: { label: "I", style: "bg-amber-100 text-amber-900", title: "Inferred" },
  missing: { label: "M", style: "bg-red-100 text-red-800", title: "Missing" },
} as const;

function Matrix({ view, mode }: { view: ComparisonView; mode: BasketMode }) {
  const { lines, suppliers, cells, result } = view;
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const open = pinned ?? hover;
  const best = cheapest(result, mode);
  const lastCycleTotal = mode === "common" ? result.lastCycleCommonBasket : result.lastCycleAllLines;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (pinned && tableRef.current && !(e.target as Element).closest("[data-cell-card]")) setPinned(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pinned]);

  return (
    <div ref={tableRef} className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead className="text-xs">
          <tr className="bg-zinc-50 text-zinc-500">
            <th className="sticky left-0 z-10 bg-zinc-50 px-2 py-2 text-left font-medium">Line</th>
            <th className="px-2 py-2 text-right font-medium">Last cycle</th>
            {suppliers.map((s) => (
              <th key={s.code} className="px-2 py-2 text-right align-bottom">
                <span className="block font-semibold text-zinc-900">
                  {s.code}. {s.name}
                </span>
                <span className="flex justify-end gap-1">
                  {s.formats.map((f) => (
                    <FormatIcon key={f} format={f} />
                  ))}
                </span>
                {s.is_incumbent && <span className="text-[10px] uppercase">Incumbent</span>}
              </th>
            ))}
            <th className="px-2 py-2 text-right font-medium">L1</th>
            <th className="px-2 py-2 text-right font-medium">Spread</th>
          </tr>
          <SummaryRow label="Coverage" view={view}>
            {(s) => {
              const r = result.suppliers.find((x) => x.code === s)!;
              return (
                <span title={r.quoted !== r.countable ? `${r.quoted} quoted; ${r.quoted - r.countable} not counted (substitute awaiting sign-off or not readable)` : undefined}>
                  {r.countable}/{lines.length}
                  {r.quoted !== r.countable && <span className="text-zinc-500"> ({r.quoted} quoted)</span>}
                </span>
              );
            }}
          </SummaryRow>
          <SummaryRow label={mode === "common" ? `Common basket total (${result.commonBasket.length} lines)` : "All lines total (gaps at lowest other quote)"} view={view}>
            {(s) => {
              const r = result.suppliers.find((x) => x.code === s)!;
              return (
                <span className={s === best ? "rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-900" : "font-medium text-zinc-900"}>
                  {formatInrCompact(totalFor(r, mode))}
                  {mode === "all" && r.gapFilledLines.length > 0 && (
                    <span className="block text-[11px] font-normal italic text-zinc-500">{r.gapFilledLines.length} gap-priced</span>
                  )}
                </span>
              );
            }}
          </SummaryRow>
          <SummaryRow label="Questionnaire" view={view}>
            {(s) => {
              const sup = suppliers.find((x) => x.code === s)!;
              const pass = sup.questionnairePassed === sup.questionnaireTotal;
              return (
                <span className={pass ? "text-emerald-700" : "text-red-700"}>
                  {pass ? "Pass" : "Fail"} {sup.questionnairePassed}/{sup.questionnaireTotal}
                </span>
              );
            }}
          </SummaryRow>
          <SummaryRow label="Freshness" view={view}>
            {() => <span className="text-zinc-400">Not assessed yet</span>}
          </SummaryRow>
        </thead>
        <tbody>
          {lines.map((line) => {
            const lr = result.lines.find((l) => l.lineNo === line.line_no)!;
            const outside = mode === "common" && !lr.inCommonBasket;
            return (
              <tr key={line.id} className={`border-t border-zinc-100 ${outside ? "bg-zinc-50/70 text-zinc-400" : ""}`}>
                <td className="sticky left-0 z-10 max-w-[18rem] bg-inherit px-2 py-1.5">
                  <span className="text-zinc-500">{line.line_no}.</span> <span className={outside ? "" : "text-zinc-900"}>{line.description}</span>
                  <span className="block text-[11px] text-zinc-500">
                    qty {line.quantity} {line.uom}
                    {line.memory_exposed && " · memory-exposed"}
                    {outside && " · outside common basket"}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-zinc-500">{formatInr(line.last_cycle_price_inr)}</td>
                {suppliers.map((s) => {
                  const cell = cells[s.code]?.[line.line_no];
                  const key = `${s.code}:${line.line_no}`;
                  const isL1 = lr.l1.includes(s.code);
                  const gap = mode === "all" && !lr.countable[s.code] ? lr.gapFill[s.code] : null;
                  const badge = cell ? BADGE[cell.confidence_state] : BADGE.missing;
                  const pendingSub = cell?.substitute_status === "pending" || cell?.substitute_status === "rejected";
                  return (
                    <td
                      key={s.code}
                      className={`relative px-2 py-1.5 text-right ${isL1 && !outside ? "bg-emerald-50" : ""}`}
                      onMouseEnter={() => setHover(key)}
                      onMouseLeave={() => setHover((h) => (h === key ? null : h))}
                    >
                      <button
                        type="button"
                        onClick={() => setPinned(pinned === key ? null : key)}
                        onFocus={() => setHover(key)}
                        onBlur={() => setHover((h) => (h === key ? null : h))}
                        aria-label={`${s.name}, line ${line.line_no}: ${cell?.normalised_value_inr != null ? formatInr(cell.normalised_value_inr) : "not quoted"}, ${badge.title}`}
                        className="inline-flex w-full items-center justify-end gap-1"
                      >
                        {cell && cell.openFlags.length > 0 && (
                          <span className="text-amber-700" title={`${cell.openFlags.length} open flag${cell.openFlags.length > 1 ? "s" : ""}`}>
                            ⚑
                          </span>
                        )}
                        {pendingSub && <span className="rounded bg-violet-100 px-1 text-[10px] text-violet-800">sub</span>}
                        <span className={`${isL1 && !outside ? "font-semibold text-emerald-900" : ""} ${pendingSub ? "text-zinc-400 line-through decoration-zinc-300" : ""}`}>
                          {cell?.normalised_value_inr != null ? formatInr(cell.normalised_value_inr) : <span className="text-zinc-400">none</span>}
                        </span>
                        <span title={badge.title} className={`rounded px-1 text-[10px] font-medium ${badge.style}`}>
                          {badge.label}
                        </span>
                      </button>
                      {gap !== null && <span className="block text-[11px] italic text-zinc-500">gap: {formatInr(gap)} (lowest other)</span>}
                      {open === key && cell && (
                        <div data-cell-card className={`absolute top-full z-30 mt-1 ${suppliers.indexOf(s) >= 2 ? "right-0" : "left-0"}`}>
                          <CellCard cell={cell} supplierName={s.name} lineLabel={`Line ${line.line_no}: ${line.description}`} />
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-right">
                  {lr.l1Value !== null ? (
                    <>
                      <span className="font-medium text-emerald-900">{lr.l1.join(", ")}</span>
                      <span className="block text-[11px] text-zinc-500">{formatInr(lr.l1Value)}</span>
                    </>
                  ) : (
                    <span className="text-zinc-400">none</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right text-zinc-600">{lr.spreadPct !== null ? `${lr.spreadPct.toFixed(1)}%` : ""}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-zinc-300 text-sm">
          <tr>
            <td className="sticky left-0 bg-white px-2 py-2 font-medium">{mode === "common" ? "Common basket total" : "All lines total"}</td>
            <td className="px-2 py-2 text-right text-zinc-600">{formatInrCompact(lastCycleTotal)}</td>
            {suppliers.map((s) => {
              const r = result.suppliers.find((x) => x.code === s.code)!;
              const total = totalFor(r, mode);
              const vsLast = lastCycleTotal ? ((total - lastCycleTotal) / lastCycleTotal) * 100 : null;
              return (
                <td key={s.code} className="px-2 py-2 text-right">
                  <span className={s.code === best ? "font-semibold text-emerald-900" : "font-medium"}>{formatInrCompact(total)}</span>
                  {vsLast !== null && (
                    <span className="block text-[11px] text-zinc-500">
                      {vsLast >= 0 ? "+" : ""}
                      {vsLast.toFixed(1)}% vs last cycle
                    </span>
                  )}
                </td>
              );
            })}
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SummaryRow({ label, view, children }: { label: string; view: ComparisonView; children: (code: string) => React.ReactNode }) {
  return (
    <tr className="border-t border-zinc-100 bg-zinc-50/60">
      <th className="sticky left-0 z-10 bg-zinc-50 px-2 py-1 text-left font-medium text-zinc-500">{label}</th>
      <th />
      {view.suppliers.map((s) => (
        <th key={s.code} className="px-2 py-1 text-right font-normal">
          {children(s.code)}
        </th>
      ))}
      <th colSpan={2} />
    </tr>
  );
}

function QuestionnaireTab({ view }: { view: ComparisonView }) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">Question</th>
            {view.suppliers.map((s) => (
              <th key={s.code} className="px-3 py-2 text-left">
                {s.code}. {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.questions.map((q) => (
            <tr key={q.key} className="border-t border-zinc-100 align-top">
              <td className="max-w-[16rem] px-3 py-2">{q.text}</td>
              {view.suppliers.map((s) => {
                const a = view.answers[s.code]?.[q.key];
                return (
                  <td key={s.code} className="px-3 py-2">
                    <span className={`font-medium ${a?.pass_fail === "pass" ? "text-emerald-700" : "text-red-700"}`}>{a?.pass_fail === "pass" ? "Pass" : "Fail"}</span>
                    <span className="block text-xs text-zinc-600">{a?.answer ?? "Not answered."}</span>
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
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {view.suppliers.map((s) => (
        <div key={s.code} className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
          <p className="font-medium">
            {s.code}. {s.name}
          </p>
          <ul className="mt-2 space-y-1">
            {s.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <FormatIcon format={d.format} />
                <Link href={`/quotes?supplier=${s.code}`} className="truncate text-zinc-800 underline-offset-2 hover:underline" title={d.file_name}>
                  {d.file_name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function ComparisonScreen({ view }: { view: ComparisonView }) {
  const [tab, setTab] = useState<Tab>("matrix");
  const [mode, setMode] = useState<BasketMode>("common");
  const tabs: [Tab, string][] = [
    ["matrix", "Quote Comparison"],
    ["questionnaire", "Questionnaire answers"],
    ["documents", "Documents"],
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Quote Comparison</h2>
          <p className="text-sm text-zinc-600">INR per piece, ex-GST, delivered to hub. Hover any cell for its source and ledger; click to pin it.</p>
        </div>
        <div role="tablist" className="flex gap-1">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-sm ${tab === key ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "matrix" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">Basket</legend>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="mode" checked={mode === "common"} onChange={() => setMode("common")} />
                Common basket ({view.result.commonBasket.length} lines every supplier can be counted on)
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="mode" checked={mode === "all"} onChange={() => setMode("all")} />
                All lines, gaps priced at the lowest other quote
              </label>
            </fieldset>
            <p className="flex flex-wrap gap-3 text-xs text-zinc-600">
              <span>
                <span className="rounded bg-zinc-100 px-1">E</span> Extracted
              </span>
              <span>
                <span className="rounded bg-amber-100 px-1">I</span> Inferred
              </span>
              <span>
                <span className="rounded bg-red-100 px-1">M</span> Missing
              </span>
              <span>⚑ open flag</span>
              <span>
                <span className="rounded bg-violet-100 px-1">sub</span> substitute awaiting sign-off, not counted
              </span>
              <span>
                <span className="rounded bg-emerald-50 px-1">L1</span> lowest counted price
              </span>
            </p>
          </div>
          {mode === "all" && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              All-lines totals price each gap at the lowest other supplier&apos;s quote so suppliers can be compared on the full RFx. Gap prices are
              not quotes; they are labelled in each cell.
            </p>
          )}
          <Matrix view={view} mode={mode} />
        </>
      )}
      {tab === "questionnaire" && <QuestionnaireTab view={view} />}
      {tab === "documents" && <DocumentsTab view={view} />}
    </section>
  );
}
