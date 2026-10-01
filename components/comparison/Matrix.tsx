"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cheapest, totalFor, type BasketMode, type ComparisonResult } from "@/lib/comparison/build";
import type { ComparisonView } from "@/lib/comparison/load";
import type { LineItemRow } from "@/lib/db/types";
import { formatInrCompact } from "@/lib/format/inr";
import { cn } from "@/lib/utils";
import { displayDate, revisionOf } from "../quotes/format";
import { Badge } from "../ui/badge";
import { Popover, PopoverAnchor, PopoverContent } from "../ui/popover";
import { Stamp } from "../ui/Stamp";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Value } from "../ui/Value";
import { CellCard } from "./CellCard";

const num = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, LineItemRow>();

// Short words for why Decision-ready leaves a supplier out, for the column header.
const shortReason = (r: string) => (r.includes("Stale") ? "Stale" : r.includes("questionnaire") ? "questionnaire" : r);

// The Quote Comparison ledger: pinned line column, sticky supplier headers and totals,
// L1 marked with a thin ledger bar on the cell's left edge. One card shows a cell's
// source and ledger on hover, focus or click; Lens citations pulse amber, then stay
// selected.
export function Matrix({
  view,
  mode,
  onOpenSupplier,
  onOpenRules,
  onOpenSubstitute,
  highlight,
  result,
  excluded = {},
}: {
  view: ComparisonView;
  // The result to mark L1 and totals with: all suppliers, or a filtered set.
  result: ComparisonResult;
  // Suppliers left out of that result, with why; their columns stay visible but muted.
  excluded?: Record<string, string[]>;
  mode: BasketMode;
  onOpenSupplier: (code: string) => void;
  onOpenRules: (code: string) => void;
  onOpenSubstitute: (key: string) => void;
  highlight: { key: string; n: number } | null;
}) {
  const { lines, suppliers, cells } = view;
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [cited, setCited] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<{ getBoundingClientRect: () => DOMRect }>({ getBoundingClientRect: () => new DOMRect() });
  const open = pinned ?? hover;
  const best = cheapest(result, mode);
  const lastCycleTotal = mode === "common" ? result.lastCycleCommonBasket : result.lastCycleAllLines;
  const lineResult = useMemo(() => new Map(result.lines.map((l) => [l.lineNo, l])), [result]);

  // Hover opens the card; leaving waits a moment so the pointer can reach the card.
  const enter = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHover(key);
  };
  const leave = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHover(null), 120);
  };

  useEffect(() => {
    if (!highlight) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-cell="${highlight.key}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", inline: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el.classList.remove("cited");
    void el.offsetWidth;
    el.classList.add("cited");
    // The cited cell stays selected after its pulse.
    setCited(highlight.key);
    const t = setTimeout(() => el.classList.remove("cited"), 2000);
    return () => clearTimeout(t);
  }, [highlight]);

  const openCell = useMemo(() => {
    if (!open) return null;
    const [code, line] = open.split(":");
    const cell = cells[code]?.[Number(line)];
    const supplier = suppliers.find((s) => s.code === code);
    const lineRow = lines.find((l) => l.line_no === Number(line));
    return cell && supplier && lineRow ? { key: open, cell, supplier, lineRow } : null;
  }, [open, cells, suppliers, lines]);
  // The card anchors to the open cell; one card serves every cell.
  useLayoutEffect(() => {
    const el = openCell ? scrollRef.current?.querySelector<HTMLElement>(`[data-cell="${openCell.key}"]`) : null;
    if (el) anchorRef.current = { getBoundingClientRect: () => el.getBoundingClientRect() };
  }, [openCell]);

  const columns = useMemo(
    () => [
      helper.display({
        id: "line",
        header: () => (
          <div className="flex h-full flex-col justify-end text-meta text-slate">
            <span className="flex h-12 items-end justify-end pb-1">Supplier</span>
            <span className="flex h-6 items-center justify-end">Lines quoted, questionnaire</span>
            <span className="flex h-8 items-center justify-between">
              <span className="font-semibold text-ink">Line</span>
              <span>Quote Freshness</span>
            </span>
            {Object.keys(excluded).length > 0 && <span className="h-5" />}
          </div>
        ),
        cell: ({ row }) => {
          const line = row.original;
          return (
            <span className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-meta text-slate">{line.line_no}</span>
              <span className="min-w-0 truncate" title={line.description}>
                {line.description}
              </span>
              {line.memory_exposed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="ml-auto shrink-0">
                      <Badge variant="pencil" className="px-1 font-semibold">
                        M<span className="sr-only">emory-exposed line</span>
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Memory-exposed line: Quote Freshness checks it against the illustrative memory price index.</TooltipContent>
                </Tooltip>
              )}
            </span>
          );
        },
        footer: () => (
          <>
            <span className="block font-semibold">{mode === "common" ? "Common basket total" : "All lines total"}</span>
            <span className="block text-meta text-slate">Against last cycle</span>
          </>
        ),
      }),
      helper.display({
        id: "qty",
        header: () => <span className="text-meta text-slate">Qty</span>,
        cell: ({ row }) => <span className="text-slate">{row.original.quantity}</span>,
      }),
      helper.display({
        id: "last",
        header: () => <span className="text-meta text-slate">Last cycle</span>,
        cell: ({ row }) => <span className="text-slate">{row.original.last_cycle_price_inr !== null ? num(row.original.last_cycle_price_inr) : ""}</span>,
        footer: () => <span className="text-slate">{formatInrCompact(lastCycleTotal)}</span>,
      }),
      ...suppliers.map((s) =>
        helper.display({
          id: `s:${s.code}`,
          header: () => {
            const r = view.result.suppliers.find((x) => x.code === s.code)!;
            const f = view.freshness[s.code];
            const out = excluded[s.code];
            const passed = s.questionnairePassed === s.questionnaireTotal;
            return (
              <div className="flex flex-col items-end">
                <span className="flex h-12 flex-col items-end justify-end pb-1">
                  <button
                    type="button"
                    onClick={() => onOpenSupplier(s.code)}
                    className="line-clamp-2 text-right text-table leading-4 font-semibold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
                    title={`Open ${s.name}: details, terms and Quote Freshness`}
                  >
                    <span className="text-slate">{s.code}</span> {s.name}
                  </button>
                  {s.is_incumbent && <span className="text-meta text-slate">Incumbent</span>}
                </span>
                <span className="flex h-6 items-center gap-2">
                  <span className="text-table" title={r.quoted !== r.countable ? `${r.quoted} quoted; ${r.quoted - r.countable} not counted` : `${r.countable} of ${lines.length} lines can be counted`}>
                    {r.countable}/{lines.length}
                    <span className="sr-only"> lines</span>
                  </span>
                  <Badge variant={passed ? "ledger" : "oxblood"} className="font-semibold">
                    {s.questionnairePassed}/{s.questionnaireTotal}
                    <span className="sr-only"> questionnaire questions passed</span>
                  </Badge>
                </span>
                <span className="flex h-8 items-center">
                  {f ? <Stamp status={f.status} onClick={() => onOpenRules(s.code)} title={f.fired.map((x) => x.label).join(", ") || "No freshness rules fired"} /> : <span className="text-meta text-slate">Not extracted</span>}
                </span>
                {Object.keys(excluded).length > 0 && <span className="flex h-5 items-center text-meta font-semibold text-oxblood">{out ? `Excluded: ${[...new Set(out.map(shortReason))].join(", ")}` : ""}</span>}
              </div>
            );
          },
          // Price cells are drawn by supplierCell below, inside the td that carries their state.
          cell: () => null,
          footer: () => {
            const r = result.suppliers.find((x) => x.code === s.code);
            if (!r) return <span className="text-meta text-slate">Excluded</span>;
            const total = totalFor(r, mode);
            const vsLast = lastCycleTotal ? ((total - lastCycleTotal) / lastCycleTotal) * 100 : null;
            const isBest = s.code === best;
            return (
              <>
                <span className={cn("block font-semibold", isBest && "text-heading text-ledger")}>
                  {formatInrCompact(total)}
                  {isBest && <span className="sr-only"> (lowest)</span>}
                </span>
                {vsLast !== null && (
                  <span className="block text-meta text-slate">
                    {Math.abs(vsLast).toFixed(1)}% {vsLast > 0 ? "higher" : "lower"}
                  </span>
                )}
              </>
            );
          },
        }),
      ),
      helper.display({
        id: "l1",
        header: () => <span className="text-meta font-semibold text-ink">L1</span>,
        cell: ({ row }) => {
          const lr = lineResult.get(row.original.line_no)!;
          return lr.l1Value !== null ? (
            <span className="flex items-center justify-end gap-2">
              {lr.l1.map((c) => (
                <Badge key={c} variant="neutral" className="px-1 font-semibold text-ink">
                  {c}
                </Badge>
              ))}
              <span className="font-semibold">{num(lr.l1Value)}</span>
            </span>
          ) : (
            <Value state="missing" reason="No supplier can be counted on this line" />
          );
        },
      }),
    ],
    [suppliers, lines.length, view.result, view.freshness, excluded, result, mode, best, lastCycleTotal, lineResult, onOpenSupplier, onOpenRules],
  );

  const table = useTable({ features, columns, data: lines });

  // One price cell's button, inside the td that carries its selection and hover state.
  function supplierCell(line: LineItemRow, code: string) {
    const cell = cells[code]?.[line.line_no];
    const s = suppliers.find((x) => x.code === code)!;
    const lr = lineResult.get(line.line_no)!;
    const key = `${code}:${line.line_no}`;
    const outside = mode === "common" && !lr.inCommonBasket;
    const isL1 = lr.l1.includes(code) && !outside && !excluded[code];
    const gap = mode === "all" && !excluded[code] && !lr.countable[code] ? lr.gapFill[code] : null;
    const sub = cell?.substitute_status === "pending" || cell?.substitute_status === "rejected";
    const missing = !cell || cell.normalised_value_inr === null || cell.confidence_state === "missing";
    const rev = cell ? revisionOf(cell.steps) : null;
    const high = cell?.openFlags.some((f) => f.severity === "high");
    const label = [
      `${s.name}, line ${line.line_no}: ${missing ? "not quoted" : `₹${num(cell!.normalised_value_inr!)}, ${cell!.confidence_state}`}`,
      rev && `revised from ₹${num(Number(rev.input))}`,
      isL1 && "L1",
      sub && "substitute, not counted",
      cell?.openFlags.length && `${cell.openFlags.length} open flag${cell.openFlags.length > 1 ? "s" : ""}: ${cell.openFlags.map((f) => f.message).join("; ")}`,
    ]
      .filter(Boolean)
      .join(", ");
    return (
      <button
        type="button"
        onClick={() => (cell?.substitute_check && cell.substitute_status !== null ? onOpenSubstitute(key) : setPinned(pinned === key ? null : key))}
        onFocus={() => enter(key)}
        onBlur={leave}
        aria-label={label}
        className="relative flex h-9 w-full items-center justify-end gap-1.5 px-3"
      >
        {isL1 && <span aria-hidden className="absolute inset-y-1 left-0 w-[3px] bg-ledger" />}
        {cell && cell.openFlags.length > 0 && <span aria-hidden className={cn("absolute top-1 right-1 size-1.5 rounded-full", high ? "bg-oxblood" : "bg-amber")} />}
        {sub && <Badge className="px-1 leading-4">Sub</Badge>}
        {missing ? (
          gap !== null ? (
            <span className="text-slate italic">gap {num(gap)}</span>
          ) : (
            <Value plain state="missing" />
          )
        ) : (
          <Value
            plain
            state={cell!.confidence_state}
            revised={rev ? { was: num(Number(rev.input)), date: displayDate(rev.rate_date) } : null}
            className={cn(isL1 && "font-semibold", sub && "text-slate line-through decoration-slate")}
          >
            {num(cell!.normalised_value_inr!)}
          </Value>
        )}
      </button>
    );
  }

  const n = suppliers.length;
  const anyExcluded = Object.keys(excluded).length > 0;
  const frame = (id: string): { sticky: string; cls: string } => {
    if (id === "line") return { sticky: "sticky left-0", cls: "border-r border-r-rule text-left" };
    if (id === "l1") return { sticky: "sticky right-0", cls: "border-l border-l-rule text-right" };
    if (id === "last") return { sticky: "", cls: "border-r border-r-rule text-right" };
    return { sticky: "", cls: "text-right" };
  };

  return (
    <>
      <div ref={scrollRef} onScroll={() => setHover(null)} className="max-h-[max(20rem,calc(100vh-20rem))] overflow-auto rounded-xs border border-rule bg-sheet [contain:paint]">
        <table className="w-full table-fixed border-separate border-spacing-0 text-table" style={{ minWidth: `${208 + 56 + 96 + n * 112 + 128}px` }}>
          <colgroup>
            <col className="w-[260px] @max-5xl:w-[208px]" />
            <col className="w-14" />
            <col className="w-24" />
            {suppliers.map((s) => (
              <col key={s.code} />
            ))}
            <col className="w-32" />
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((h) => {
                  const f = frame(h.column.id);
                  const out = h.column.id.startsWith("s:") && excluded[h.column.id.slice(2)];
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className={cn(
                        "sticky top-0 border-b-2 border-b-rule-strong bg-sheet px-3 py-2 align-bottom font-normal",
                        f.cls,
                        f.sticky ? `${f.sticky} z-30` : "z-20",
                        out && "bg-paper",
                      )}
                    >
                      <table.FlexRender header={h} />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const lr = lineResult.get(row.original.line_no)!;
              const outside = mode === "common" && !lr.inCommonBasket;
              return (
                <tr key={row.id} className={cn("group", outside && "text-slate")}>
                  {row.getAllCells().map((c) => {
                    const id = c.column.id;
                    const f = frame(id);
                    const base = "h-9 border-b border-rule whitespace-nowrap group-hover:bg-tint";
                    if (id.startsWith("s:")) {
                      const code = id.slice(2);
                      const key = `${code}:${row.original.line_no}`;
                      const selected = pinned === key || cited === key;
                      return (
                        <td
                          key={c.id}
                          data-cell={key}
                          onMouseEnter={() => enter(key)}
                          onMouseLeave={leave}
                          className={cn(base, "relative p-0 text-right", excluded[code] && "bg-paper text-slate", open === key && "bg-tint", selected && "bg-tint shadow-[inset_0_0_0_1px_var(--ink)]")}
                        >
                          {supplierCell(row.original, code)}
                        </td>
                      );
                    }
                    const Cell = id === "line" ? "th" : "td";
                    return (
                      <Cell key={c.id} scope={id === "line" ? "row" : undefined} className={cn(base, "bg-sheet px-3 font-normal", f.cls, f.sticky && `${f.sticky} z-10`)}>
                        <table.FlexRender cell={c} />
                      </Cell>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {table.getFooterGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((h) => {
                  const f = frame(h.column.id);
                  const out = h.column.id.startsWith("s:") && !result.suppliers.some((r) => `s:${r.code}` === h.column.id);
                  const Cell: "th" | "td" = h.column.id === "line" ? "th" : "td";
                  return (
                    <Cell
                      key={h.id}
                      scope={h.column.id === "line" ? "row" : undefined}
                      className={cn("sticky bottom-0 h-14 border-t-2 border-t-rule-strong bg-sheet px-3 py-2 align-top font-normal whitespace-nowrap", f.cls, f.sticky ? `${f.sticky} z-30` : "z-20", out && "bg-paper")}
                    >
                      {h.column.columnDef.footer ? <table.FlexRender footer={h} /> : null}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      {anyExcluded && <span className="sr-only">Excluded suppliers stay visible, muted, so the change is visible.</span>}
      <Popover
        open={!!openCell}
        onOpenChange={(o) => {
          if (!o) {
            setPinned(null);
            setHover(null);
            setCited(null);
          }
        }}
      >
        <PopoverAnchor virtualRef={anchorRef} />
        {openCell && (
          <PopoverContent
            // Pinning remounts the card so focus moves into it; hovering never takes focus.
            key={`${openCell.key}-${pinned ? "pinned" : "hover"}`}
            side="bottom"
            align="end"
            role={pinned ? "dialog" : "tooltip"}
            aria-label={`${openCell.supplier.name}, line ${openCell.lineRow.line_no}`}
            onOpenAutoFocus={(e) => {
              if (!pinned) e.preventDefault();
            }}
            onCloseAutoFocus={(e) => {
              // A pinned card hands focus back to its cell; a hover card never had it.
              e.preventDefault();
              if (pinned) scrollRef.current?.querySelector<HTMLElement>(`[data-cell="${pinned}"] button`)?.focus();
            }}
            onInteractOutside={(e) => {
              // A click on the cell itself toggles the card; let the cell handle it.
              if ((e.target as Element | null)?.closest?.(`[data-cell="${openCell.key}"]`)) e.preventDefault();
            }}
            onMouseEnter={() => closeTimer.current && clearTimeout(closeTimer.current)}
            onMouseLeave={pinned ? undefined : leave}
          >
            <CellCard
              cell={openCell.cell}
              supplierName={`${openCell.supplier.code}. ${openCell.supplier.name}`}
              lineLabel={`Line ${openCell.lineRow.line_no}: ${openCell.lineRow.description}`}
              onOpenSubstitute={() => {
                setPinned(null);
                onOpenSubstitute(openCell.key);
              }}
            />
          </PopoverContent>
        )}
      </Popover>
    </>
  );
}

export function Legend({ children }: { children?: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-slate">
      <span className="inline-flex items-center gap-1.5">
        <span className="text-table text-ink">63,900</span> Extracted
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Value plain state="inferred" className="text-table">
          71,400
        </Value>{" "}
        Inferred
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="val-missing inline-block h-3 w-8" /> Missing
      </span>
      <span aria-hidden className="h-3 w-px bg-rule" />
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-3 w-[3px] bg-ledger" /> L1
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block size-1.5 rounded-full bg-oxblood" /> Open flag
      </span>
      <span className="inline-flex items-center gap-1.5">
        <s className="decoration-slate">48,350</s> Revised
      </span>
      {children}
    </p>
  );
}
