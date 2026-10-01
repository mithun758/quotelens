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
  next = null,
}: {
  detail: SupplierDetail;
  documents: ViewerDocument[];
  freshness: string | null;
  // Opened from a Lens citation: show this document at this place.
  cited?: { documentId: string; locator: string } | null;
  // The next supplier with open items, for the empty queue.
  next?: { code: string; name: string; count: number } | null;
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

  const rev = selected ? revisionOf(selected.steps) : null;
  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="text-heading font-semibold">
            <span className="text-slate">{supplier.code}</span> {supplier.name}
          </h3>
          {freshness && <Stamp status={freshness} title="Quote Freshness; details on Quote Comparison" />}
        </div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-2 text-table @4xl:grid-cols-6">
          {fields.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-meta text-slate">{k}</dt>
              <dd className={`truncate ${v === "Not stated" ? "text-slate" : ""}`} title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid gap-6 @3xl:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
        <div className="min-w-0 space-y-2 @3xl:sticky @3xl:top-[4.75rem] @3xl:self-start">
          <DocumentViewer documents={documents} activeId={activeDocId} onSelect={setActiveDocId} highlight={highlight} />
          {selected && (
            <figure className="rounded-xs border border-rule bg-sheet px-3 py-2 text-meta">
              <figcaption className="text-slate">
                Source: {sourceDoc?.file_name ?? "email body"}
                {locatorLabel(selected.source_locator) && `, ${locatorLabel(selected.source_locator)}`}
              </figcaption>
              {selected.source_snippet && <blockquote className="mt-1 border-l-2 border-amber pl-2 text-ink">“{selected.source_snippet}”</blockquote>}
              {rev && (
                <p className="mt-1">
                  <span className="font-semibold">Revised.</span> <s className="text-slate">{inr(Number(rev.input))}</s> now {inr(Number(rev.output))}. <span className="text-slate">{rev.rate_source}</span>
                </p>
              )}
            </figure>
          )}
        </div>
        <div className="min-w-0 space-y-6">
          <ReviewQueue
            supplierCode={supplier.code}
            supplierName={supplier.name}
            items={detail.queue}
            values={detail.values}
            awaiting={detail.awaiting}
            onFocus={focusQueueItem}
            focusedValueId={selectedId}
            onAccepted={(ids) => setSettled((s) => ({ ids, n: s.n + 1 }))}
            next={next}
          />
          <SentEmails clarifications={detail.clarifications} supplierName={supplier.name} />
          <ValuesTable values={detail.values} selectedId={selectedId} onSelect={selectValue} settled={settled} />
        </div>
      </div>
    </div>
  );
}
