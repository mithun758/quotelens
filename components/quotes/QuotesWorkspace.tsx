"use client";

import { useMemo, useState } from "react";
import type { SupplierDetail } from "@/lib/quotes/load";
import { decodeLocator, encodeLocator } from "@/lib/ai/lens/citations";
import type { QueueItem } from "@/lib/review/queue";
import { Stamp } from "../ui/Stamp";
import { DocumentViewer, type SourceHighlight, type ViewerDocument } from "./DocumentViewer";
import { displayDate, inr, locatorLabel, revisionOf } from "./format";
import { ReviewQueue } from "./ReviewQueue";
import { SentEmails } from "./SentEmails";
import { ValuesTable } from "./ValuesTable";

export function QuotesWorkspace({
  detail,
  documents,
  freshness,
  cited = null,
}: {
  detail: SupplierDetail;
  documents: ViewerDocument[];
  freshness: string | null;
  // Opened from a Lens citation: show this document at this place.
  cited?: { documentId: string; locator: string } | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Open on the document most values were read from (the quotation, not a certificate).
  const [activeDocId, setActiveDocId] = useState<string | null>(() => {
    if (cited) return cited.documentId;
    const counts = new Map<string, number>();
    for (const v of detail.values) if (v.source_document_id) counts.set(v.source_document_id, (counts.get(v.source_document_id) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? documents[0]?.id ?? null;
  });
  const [settled, setSettled] = useState<{ ids: string[]; n: number }>({ ids: [], n: 0 });

  const selected = detail.values.find((v) => v.id === selectedId) ?? null;
  // A cited place shows until Priya selects a value; the value matching it supplies the snippet.
  const citedHighlight: SourceHighlight = useMemo(() => {
    if (!cited) return null;
    const locator = decodeLocator(cited.locator);
    const match = detail.values.find((v) => v.source_document_id === cited.documentId && encodeLocator(v.source_locator) === cited.locator);
    return { locator, snippet: match?.source_snippet ?? null };
  }, [cited, detail.values]);
  const highlight: SourceHighlight = useMemo(() => (selected ? { locator: selected.source_locator, snippet: selected.source_snippet } : citedHighlight), [selected, citedHighlight]);

  function selectValue(id: string) {
    const v = detail.values.find((x) => x.id === id);
    setSelectedId(id === selectedId ? null : id);
    if (v?.source_document_id) setActiveDocId(v.source_document_id);
  }

  function focusQueueItem(item: QueueItem) {
    if (item.valueId) selectValue(item.valueId);
  }

  const { supplier, response, terms } = detail;
  const sourceDoc = documents.find((d) => d.id === selected?.source_document_id);
  const fields: [string, string][] = [
    ["Received", response ? displayDate(response.received_at) : "No response"],
    ["Quote date", displayDate(terms?.quote_date) || "Not stated"],
    ["Valid until", displayDate(terms?.valid_until) || "Not stated"],
    ["Freight", terms?.freight_terms ?? "Not stated"],
    ["Payment", terms?.payment_terms ?? "Not stated"],
    ["GSTIN", supplier.gstin ? `${supplier.gstin} (${supplier.state})` : "Not on file"],
  ];

  return (
    <div className="space-y-4">
      <header className="space-y-2 border-b border-rule pb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">
            {supplier.code}. {supplier.name}
          </h3>
          {freshness && <Stamp status={freshness} title="Quote Freshness; details on Quote Comparison" />}
        </div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-2 text-[13px] @4xl:grid-cols-6">
          {fields.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-slate">{k}</dt>
              <dd className={`truncate ${v === "Not stated" ? "text-slate" : ""}`} title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-2 @4xl:sticky @4xl:top-[4.75rem] @4xl:self-start">
          <DocumentViewer documents={documents} activeId={activeDocId} onSelect={setActiveDocId} highlight={highlight} />
          {selected && (
            <p className="border-l-[3px] border-amber bg-amber-tint px-3 py-2 text-xs">
              <span className="font-semibold">Source</span> {sourceDoc?.file_name ?? "email body"}
              {locatorLabel(selected.source_locator) && `, ${locatorLabel(selected.source_locator)}`}
              {selected.source_snippet && <span className="block">“{selected.source_snippet}”</span>}
              {revisionOf(selected.steps) && (
                <span className="mt-1 block">
                  <span className="font-semibold">Revised.</span> <s className="text-slate">{inr(Number(revisionOf(selected.steps)!.input))}</s> now {inr(Number(revisionOf(selected.steps)!.output))}. {revisionOf(selected.steps)!.rate_source}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="min-w-0 space-y-5">
          <ReviewQueue
            supplierCode={supplier.code}
            supplierName={supplier.name}
            items={detail.queue}
            values={detail.values}
            awaiting={detail.awaiting}
            onFocus={focusQueueItem}
            focusedValueId={selectedId}
            onAccepted={(ids) => setSettled((s) => ({ ids, n: s.n + 1 }))}
          />
          <SentEmails clarifications={detail.clarifications} supplierName={supplier.name} />
          <ValuesTable values={detail.values} selectedId={selectedId} onSelect={selectValue} settled={settled} />
        </div>
      </div>
    </div>
  );
}
