"use client";

import { useEffect, useRef, useState } from "react";
import type { DocumentModel } from "@/lib/documents/render";
import type { SourceLocator } from "@/lib/db/types";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Highlight, PdfPage, type Zoom } from "./PdfPage";

export type ViewerDocument = { id: string; file_name: string; mime_type: string; model: DocumentModel };
export type SourceHighlight = { locator: SourceLocator | null; snippet: string | null } | null;

const norm = (s: string) => s.replace(/[“”"'₹,]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

function Marked({ text, snippet }: { text: string; snippet: string | null }) {
  if (!snippet) return <>{text}</>;
  const i = text.toLowerCase().indexOf(snippet.trim().toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-xs bg-amber-tint px-0.5 text-ink shadow-[inset_0_0_0_1px_var(--amber)]">{text.slice(i, i + snippet.trim().length)}</mark>
      {text.slice(i + snippet.trim().length)}
    </>
  );
}

function Spreadsheet({ model, highlight }: { model: Extract<DocumentModel, { kind: "spreadsheet" }>; highlight: SourceHighlight }) {
  const target = highlight?.locator;
  // The cited sheet shows by default; a tab the user picks wins until the selection changes.
  const targetKey = `${target?.sheet ?? ""}!${target?.cell ?? ""}`;
  const [picked, setPicked] = useState<{ forTarget: string; sheet: string } | null>(null);
  const sheet = picked?.forTarget === targetKey ? picked.sheet : (target?.sheet ?? model.sheets[0]?.name);
  const setSheet = (name: string) => setPicked({ forTarget: targetKey, sheet: name });
  const active = model.sheets.find((s) => s.name === sheet) ?? model.sheets[0];
  const hotRef = useRef<HTMLTableCellElement>(null);
  useEffect(() => {
    hotRef.current?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }, [active, target?.cell]);

  return (
    <div>
      <div className="flex flex-wrap gap-4 border-b border-rule px-3">
        {model.sheets.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => setSheet(s.name)}
            className={`-mb-px border-b-2 pb-1.5 pt-2 text-xs ${s.name === active.name ? "border-ink font-semibold" : "border-transparent text-slate hover:text-ink"}`}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="border-collapse text-xs">
          <thead className="sticky top-0 bg-paper text-slate">
            <tr>
              <th className="border border-rule px-1" />
              {active.columns.map((c) => (
                <th key={c} className="border border-rule px-2 font-normal">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.rows.map((row) => (
              <tr key={row.r}>
                <td className="border border-rule bg-paper px-1 text-slate">{row.r}</td>
                {row.cells
                  .filter((c) => !c.hidden)
                  .map((c) => {
                    const hot = target?.sheet === active.name && target?.cell === c.addr;
                    return (
                      <td
                        key={c.addr}
                        ref={hot ? hotRef : undefined}
                        colSpan={c.colSpan}
                        rowSpan={c.rowSpan}
                        className={`max-w-[28rem] border border-rule px-2 py-0.5 align-top ${hot ? "bg-amber-tint outline-2 outline-amber" : ""}`}
                      >
                        {c.text}
                      </td>
                    );
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Lines({ model, highlight }: { model: Extract<DocumentModel, { kind: "lines" }>; highlight: SourceHighlight }) {
  const loc = highlight?.locator;
  const snippet = highlight?.snippet ?? null;
  // Prefer the cited paragraph or line; fall back to wherever the snippet appears.
  const cited = model.marker === "P" ? loc?.paragraph : loc?.line;
  const bySnippet = snippet ? model.lines.find((l) => norm(l.text).includes(norm(snippet)))?.n : undefined;
  const hot = cited && model.lines.some((l) => l.n === cited && (!snippet || norm(l.text).includes(norm(snippet)))) ? cited : (bySnippet ?? cited);
  const hotRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    hotRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [hot, snippet]);

  return (
    <div className={`max-h-[70vh] overflow-auto p-3 text-sm ${model.marker === "L" ? "text-[13px]" : ""}`}>
      {model.lines.map((l) => (
        <div
          key={l.n}
          ref={l.n === hot ? hotRef : undefined}
          className={`flex gap-3 rounded px-1 ${model.marker === "P" ? "py-1" : ""} ${l.n === hot ? "bg-amber-tint" : ""}`}
        >
          <span className="w-8 shrink-0 select-none text-right text-slate">
            {model.marker}
            {l.n}
          </span>
          <span className="whitespace-pre-wrap">{l.n === hot ? <Marked text={l.text} snippet={snippet} /> : l.text || " "}</span>
        </div>
      ))}
    </div>
  );
}

export function DocumentViewer({
  documents,
  activeId,
  onSelect,
  highlight,
}: {
  documents: ViewerDocument[];
  activeId: string | null;
  onSelect: (id: string) => void;
  highlight: SourceHighlight;
}) {
  const active = documents.find((d) => d.id === activeId) ?? documents[0];
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [pageCount, setPageCount] = useState<{ url: string; n: number } | null>(null);
  // The page the source sits on, until Priya turns the page herself.
  const sourcePage = highlight?.locator?.page ?? 1;
  const [picked, setPicked] = useState<{ forKey: string; page: number } | null>(null);
  const pageKey = `${active?.id}|${sourcePage}|${highlight?.snippet ?? ""}`;
  const page = picked?.forKey === pageKey ? picked.page : sourcePage;
  // Keep the active document's tab in view when there are more tabs than fit.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = tabsRef.current;
    const tab = row?.querySelector<HTMLElement>("[aria-current=true]");
    if (row && tab) row.scrollLeft = Math.max(0, tab.offsetLeft - row.offsetLeft - 12);
  }, [active?.id]);
  if (!active) return <p className="text-body text-slate">No documents.</p>;
  const bbox = highlight?.locator?.bbox && highlight.locator.bbox.length === 4 && page === sourcePage ? (highlight.locator.bbox as [number, number, number, number]) : null;
  const pages = active.model.kind === "pdf" && pageCount?.url === active.model.url ? pageCount.n : null;
  const zoomable = active.model.kind === "pdf" || active.model.kind === "image";
  const original = active.model.kind === "pdf" || active.model.kind === "image" ? active.model.url : null;

  return (
    <div className="rounded-xs border border-rule bg-sheet">
      {documents.length > 1 && (
        <div ref={tabsRef} className="flex gap-x-4 overflow-x-auto border-b border-rule px-3">
          {documents.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d.id)}
              aria-current={d.id === active.id}
              className={`-mb-px max-w-[13rem] shrink-0 truncate border-b-2 pt-2.5 pb-2 text-meta ${d.id === active.id ? "border-ink font-semibold" : "border-transparent text-slate hover:text-ink"}`}
              title={d.file_name}
            >
              {d.file_name}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 border-b border-rule px-3 py-2 text-meta">
        <span className="min-w-0 flex-1 truncate font-semibold" title={active.file_name}>
          {active.file_name}
        </span>
        {pages && pages > 1 && (
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => setPicked({ forKey: pageKey, page: page - 1 })}>
              <ChevronLeft aria-hidden />
            </Button>
            <span className="text-slate">
              Page {page} of {pages}
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={page >= pages} onClick={() => setPicked({ forKey: pageKey, page: page + 1 })}>
              <ChevronRight aria-hidden />
            </Button>
          </span>
        )}
        {zoomable && (
          <ToggleGroup type="single" size="sm" aria-label="Zoom" value={String(zoom)} onValueChange={(v) => v && setZoom(v === "fit" ? "fit" : (Number(v) as 1 | 1.5))}>
            <ToggleGroupItem value="fit">Fit</ToggleGroupItem>
            <ToggleGroupItem value="1">100%</ToggleGroupItem>
            <ToggleGroupItem value="1.5">150%</ToggleGroupItem>
          </ToggleGroup>
        )}
        {original && (
          <a href={original} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
            Open original
            <ExternalLink aria-hidden className="size-3.5 stroke-[1.5]" />
          </a>
        )}
      </div>
      {active.model.kind === "spreadsheet" && <Spreadsheet model={active.model} highlight={highlight} />}
      {active.model.kind === "lines" && <Lines model={active.model} highlight={highlight} />}
      {active.model.kind === "pdf" && (
        <div className="max-h-[75vh] overflow-auto p-2">
          <PdfPage
            url={active.model.url}
            page={page}
            bbox={bbox}
            snippet={page === sourcePage ? (highlight?.snippet ?? null) : null}
            zoom={zoom}
            onPageCount={(n) => active.model.kind === "pdf" && setPageCount({ url: active.model.url, n })}
          />
        </div>
      )}
      {active.model.kind === "image" && (
        <div className="max-h-[75vh] overflow-auto p-2">
          <div className={zoom === "fit" ? "relative" : "relative w-max"}>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, shown as-is */}
            <img
              src={active.model.url}
              alt={active.file_name}
              className={zoom === "fit" ? "h-auto w-full" : "h-auto max-w-none"}
              style={zoom === 1.5 ? { width: "150%" } : undefined}
            />
            {bbox && <Highlight bbox={bbox} />}
          </div>
        </div>
      )}
    </div>
  );
}
