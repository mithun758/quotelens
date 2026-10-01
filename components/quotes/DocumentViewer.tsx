"use client";

import { useEffect, useRef, useState } from "react";
import type { DocumentModel } from "@/lib/documents/render";
import type { SourceLocator } from "@/lib/db/types";
import { Highlight, PdfPage } from "./PdfPage";

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
      <mark className="rounded-xs bg-[#f2dcae] px-0.5">{text.slice(i, i + snippet.trim().length)}</mark>
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
                        className={`max-w-[28rem] border border-rule px-2 py-0.5 align-top ${hot ? "bg-amber-tint outline outline-2 outline-amber" : ""}`}
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
  // Keep the active document's tab in view when there are more tabs than fit.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = tabsRef.current;
    const tab = row?.querySelector<HTMLElement>("[aria-current=true]");
    if (row && tab) row.scrollLeft = Math.max(0, tab.offsetLeft - row.offsetLeft - 12);
  }, [active?.id]);
  if (!active) return <p className="text-sm text-slate">No documents.</p>;
  const bbox = highlight?.locator?.bbox && highlight.locator.bbox.length === 4 ? (highlight.locator.bbox as [number, number, number, number]) : null;

  return (
    <div className="border border-rule bg-sheet">
      <div ref={tabsRef} className="flex gap-x-4 overflow-x-auto border-b border-rule px-3">
        {documents.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d.id)}
            aria-current={d.id === active.id}
            className={`-mb-px max-w-[13rem] shrink-0 truncate border-b-2 pb-2 pt-2.5 text-xs ${d.id === active.id ? "border-ink font-semibold" : "border-transparent text-slate hover:text-ink"}`}
            title={d.file_name}
          >
            {d.file_name}
          </button>
        ))}
      </div>
      {active.model.kind === "spreadsheet" && <Spreadsheet model={active.model} highlight={highlight} />}
      {active.model.kind === "lines" && <Lines model={active.model} highlight={highlight} />}
      {active.model.kind === "pdf" && (
        <div className="max-h-[75vh] overflow-auto p-2">
          <PdfPage url={active.model.url} page={highlight?.locator?.page ?? 1} bbox={bbox} snippet={highlight?.snippet ?? null} />
        </div>
      )}
      {active.model.kind === "image" && (
        <div className="max-h-[75vh] overflow-auto p-2">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, shown as-is */}
            <img src={active.model.url} alt={active.file_name} className="h-auto w-full" />
            {bbox && <Highlight bbox={bbox} />}
          </div>
        </div>
      )}
    </div>
  );
}
