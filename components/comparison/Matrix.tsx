"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cheapest, totalFor, type BasketMode } from "@/lib/comparison/build";
import type { ComparisonView } from "@/lib/comparison/load";
import { formatInrCompact } from "@/lib/format/inr";
import { Stamp } from "../ui/Stamp";
import { Value } from "../ui/Value";
import { CellCard } from "./CellCard";

const num = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

// The ledger: dense rows, sticky line column, header and totals; L1 marked with a
// thin ledger-green bar. Cell details open in a card positioned beside the cell.
export function Matrix({
  view,
  mode,
  onOpenSupplier,
  onOpenSubstitute,
  highlight,
}: {
  view: ComparisonView;
  mode: BasketMode;
  onOpenSupplier: (code: string) => void;
  onOpenSubstitute: (key: string) => void;
  highlight: { key: string; n: number } | null;
}) {
  const { lines, suppliers, cells, result } = view;
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const open = pinned ?? hover;
  const best = cheapest(result, mode);
  const lastCycleTotal = mode === "common" ? result.lastCycleCommonBasket : result.lastCycleAllLines;

  useEffect(() => {
    if (!highlight) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-cell="${highlight.key}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", inline: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el.classList.remove("cited");
    void el.offsetWidth;
    el.classList.add("cited");
    const t = setTimeout(() => el.classList.remove("cited"), 2000);
    return () => clearTimeout(t);
  }, [highlight]);

  useEffect(() => {
    if (!pinned) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-cell-card]") && !(e.target as Element).closest(`[data-cell="${pinned}"]`)) setPinned(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPinned(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  const openCell = open ? (() => {
    const [code, line] = open.split(":");
    const cell = cells[code]?.[Number(line)];
    const supplier = suppliers.find((s) => s.code === code);
    const lineRow = lines.find((l) => l.line_no === Number(line));
    return cell && supplier && lineRow ? { key: open, cell, supplier, lineRow } : null;
  })() : null;

  const th = "border-b border-ink bg-sheet px-3 text-xs font-semibold text-slate";
  return (
    <div ref={scrollRef} className="max-h-[calc(100vh-13.5rem)] overflow-auto rounded-xs border border-rule bg-sheet" onScroll={() => setHover(null)}>
      <table className="w-full min-w-[60rem] table-fixed border-separate border-spacing-0 text-[13px]">
        <colgroup>
          <col className="w-[15rem]" />
          <col className="w-[3rem]" />
          <col className="w-[6rem]" />
          {suppliers.map((s) => (
            <col key={s.code} />
          ))}
          <col className="w-[6rem]" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={`${th} sticky left-0 top-0 z-30 py-2 align-bottom font-normal`}>
              <span className="block h-16" />
              <span className="flex h-5 items-center justify-end">Coverage</span>
              <span className="block h-[3px]" />
              <span className="flex h-5 items-center justify-end">Questionnaire</span>
              <span className="flex h-6 items-center justify-between">
                <span className="font-semibold">Line</span>
                <span>Freshness</span>
              </span>
            </th>
            <th scope="col" className={`${th} sticky top-0 z-20 text-right align-bottom`}>
              Qty
            </th>
            <th scope="col" className={`${th} sticky top-0 z-20 border-r border-r-rule text-right align-bottom`}>
              Last cycle
            </th>
            {suppliers.map((s) => {
              const r = result.suppliers.find((x) => x.code === s.code)!;
              const f = view.freshness[s.code];
              const passed = s.questionnairePassed === s.questionnaireTotal;
              return (
                <th key={s.code} scope="col" className={`${th} sticky top-0 z-20 py-2 text-right align-bottom font-normal`}>
                  <span className="flex h-12 items-end justify-end">
                    <button
                      type="button"
                      onClick={() => onOpenSupplier(s.code)}
                      className="text-right text-[13px] font-semibold leading-4 text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
                      title="Open supplier details and Quote Freshness"
                    >
                      {s.code}. {s.name}
                    </button>
                  </span>
                  <span className="block h-4">{s.is_incumbent ? "Incumbent" : ""}</span>
                  <span className="flex h-5 items-center justify-end text-ink" title={r.quoted !== r.countable ? `${r.quoted} quoted; ${r.quoted - r.countable} not counted` : undefined}>
                    {r.countable}/{lines.length}
                  </span>
                  <span aria-hidden className="ml-auto block h-[3px] w-full max-w-[6rem] bg-rule">
                    <span className="block h-full bg-ink" style={{ width: `${(r.countable / lines.length) * 100}%` }} />
                  </span>
                  <span className={`flex h-5 items-center justify-end ${passed ? "text-ledger" : "font-semibold text-oxblood"}`}>
                    {s.questionnairePassed}/{s.questionnaireTotal}
                    <span className="sr-only"> questionnaire questions passed</span>
                  </span>
                  <span className="flex h-6 items-center justify-end">
                    {f ? (
                      <button type="button" onClick={() => onOpenSupplier(s.code)} title={f.fired.map((x) => x.label).join(", ") || "No freshness rules fired"}>
                        <Stamp status={f.status} />
                      </button>
                    ) : (
                      <span>Not extracted</span>
                    )}
                  </span>
                </th>
              );
            })}
            <th scope="col" className={`${th} sticky top-0 z-20 border-l border-l-rule text-right align-bottom`}>
              L1
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const lr = result.lines.find((l) => l.lineNo === line.line_no)!;
            const outside = mode === "common" && !lr.inCommonBasket;
            const td = "h-9 border-b border-rule px-3 text-right whitespace-nowrap";
            return (
              <tr key={line.id} className={`group ${outside ? "text-slate" : ""}`}>
                <th scope="row" className="sticky left-0 z-10 h-9 border-b border-rule bg-sheet px-3 text-left font-normal group-hover:bg-tint">
                  <span className="flex items-baseline gap-2" title={`${line.description}${line.memory_exposed ? " (memory-exposed)" : ""}${outside ? ". Outside the common basket" : ""}`}>
                    <span className="w-5 shrink-0 text-right text-xs text-slate">{line.line_no}</span>
                    <span className="truncate">{line.description}</span>
                  </span>
                </th>
                <td className={`${td} text-slate group-hover:bg-tint`}>{line.quantity}</td>
                <td className={`${td} border-r border-r-rule text-slate group-hover:bg-tint`}>{line.last_cycle_price_inr !== null ? num(line.last_cycle_price_inr) : ""}</td>
                {suppliers.map((s) => {
                  const cell = cells[s.code]?.[line.line_no];
                  const key = `${s.code}:${line.line_no}`;
                  const isL1 = lr.l1.includes(s.code) && !outside;
                  const gap = mode === "all" && !lr.countable[s.code] ? lr.gapFill[s.code] : null;
                  const sub = cell?.substitute_status === "pending" || cell?.substitute_status === "rejected";
                  const missing = !cell || cell.normalised_value_inr === null || cell.confidence_state === "missing";
                  return (
                    <td
                      key={s.code}
                      data-cell={key}
                      className={`${td} relative overflow-hidden p-0 group-hover:bg-tint ${open === key ? "bg-tint" : ""}`}
                      onMouseEnter={() => setHover(key)}
                      onMouseLeave={() => setHover((h) => (h === key ? null : h))}
                    >
                      <button
                        type="button"
                        onClick={() => (cell?.substitute_check && cell.substitute_status !== null ? onOpenSubstitute(key) : setPinned(pinned === key ? null : key))}
                        onFocus={() => setHover(key)}
                        onBlur={() => setHover((h) => (h === key ? null : h))}
                        aria-label={`${s.name}, line ${line.line_no}: ${missing ? "not quoted" : `₹${num(cell!.normalised_value_inr!)}, ${cell!.confidence_state}`}${isL1 ? ", L1" : ""}${sub ? ", substitute not counted" : ""}`}
                        className="flex h-9 w-full items-center justify-end gap-1.5 px-3"
                      >
                        {cell && cell.openFlags.length > 0 && (
                          <span aria-hidden className={cell.openFlags.some((f) => f.severity === "high") ? "text-oxblood" : "text-pencil"} title={`${cell.openFlags.length} open flag${cell.openFlags.length > 1 ? "s" : ""}`}>
                            ⚑
                          </span>
                        )}
                        {sub && <span className="rounded-xs border border-field px-1 text-[11px] leading-4 text-slate">sub</span>}
                        {missing ? (
                          gap !== null ? (
                            <span className="italic text-slate" title="Gap priced at the lowest other quote; not a quote">
                              gap {num(gap)}
                            </span>
                          ) : (
                            <Value state="missing" reason={cell?.reason ?? "Not quoted"} />
                          )
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 ${isL1 ? "font-semibold" : ""} ${sub ? "text-slate line-through decoration-field" : ""}`}>
                            {isL1 && <span aria-hidden className="h-4 w-[3px] bg-ledger" />}
                            {cell!.confidence_state === "inferred" ? <span className="val-inferred">{num(cell!.normalised_value_inr!)}</span> : num(cell!.normalised_value_inr!)}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
                <td className={`${td} border-l border-l-rule group-hover:bg-tint`}>
                  {lr.l1Value !== null ? (
                    <span className="flex items-baseline justify-end gap-2">
                      <span className="text-xs text-slate">{lr.l1.join(", ")}</span>
                      <span className={outside ? "" : "font-semibold"}>{num(lr.l1Value)}</span>
                    </span>
                  ) : (
                    <Value state="missing" reason="No supplier can be counted on this line" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="sticky bottom-0 left-0 z-30 h-12 border-t-2 border-ink bg-sheet px-3 text-left text-[13px] font-semibold">
              {mode === "common" ? "Common basket total" : "All lines total"}
              <span className="block text-xs font-normal text-slate">Change against last cycle</span>
            </th>
            <td className="sticky bottom-0 z-20 border-t-2 border-ink bg-sheet" />
            <td className="sticky bottom-0 z-20 whitespace-nowrap border-t-2 border-r border-ink border-r-rule bg-sheet px-2 text-right align-top pt-2 text-slate">{formatInrCompact(lastCycleTotal)}</td>
            {suppliers.map((s) => {
              const r = result.suppliers.find((x) => x.code === s.code)!;
              const total = totalFor(r, mode);
              const vsLast = lastCycleTotal ? ((total - lastCycleTotal) / lastCycleTotal) * 100 : null;
              const isBest = s.code === best;
              return (
                <td key={s.code} className="sticky bottom-0 z-20 whitespace-nowrap border-t-2 border-ink bg-sheet px-3 text-right">
                  <span className={`flex items-center justify-end gap-1.5 font-semibold ${isBest ? "text-ledger" : ""}`}>
                    {isBest && <span aria-hidden className="h-4 w-[3px] bg-ledger" />}
                    {formatInrCompact(total)}
                    {isBest && <span className="sr-only"> (lowest)</span>}
                  </span>
                  {vsLast !== null && (
                    <span className="block text-xs text-slate">
                      {Math.abs(vsLast).toFixed(1)}% {vsLast > 0 ? "higher" : "lower"}
                    </span>
                  )}
                </td>
              );
            })}
            <td className="sticky bottom-0 z-20 border-t-2 border-l border-ink border-l-rule bg-sheet" />
          </tr>
        </tfoot>
      </table>
      {openCell && (
        <FloatingCard anchorKey={openCell.key} container={scrollRef} pinned={pinned === openCell.key} onLeave={() => setHover(null)}>
          <CellCard
            cell={openCell.cell}
            supplierName={`${openCell.supplier.code}. ${openCell.supplier.name}`}
            lineLabel={`Line ${openCell.lineRow.line_no}: ${openCell.lineRow.description}`}
            onOpenSubstitute={() => {
              setPinned(null);
              onOpenSubstitute(openCell.key);
            }}
          />
        </FloatingCard>
      )}
    </div>
  );
}

// Positions the cell card beside its cell, outside the scroll container, flipping
// above when there is no room below.
function FloatingCard({ anchorKey, container, pinned, onLeave, children }: { anchorKey: string; container: React.RefObject<HTMLDivElement | null>; pinned: boolean; onLeave: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const cell = container.current?.querySelector<HTMLElement>(`[data-cell="${anchorKey}"]`);
    const card = ref.current;
    if (!cell || !card) return;
    const r = cell.getBoundingClientRect();
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    const below = r.bottom + 4;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : below;
    setPos({ left, top });
  }, [anchorKey, container]);
  return createPortal(
    <div
      ref={ref}
      data-cell-card
      role={pinned ? "dialog" : "tooltip"}
      onMouseLeave={pinned ? undefined : onLeave}
      style={{ position: "fixed", left: pos?.left ?? -9999, top: pos?.top ?? 0, zIndex: 50 }}
    >
      {children}
    </div>,
    document.body,
  );
}
