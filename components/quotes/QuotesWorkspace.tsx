"use client";

import { useMemo, useState } from "react";
import type { SupplierDetail } from "@/lib/quotes/load";
import type { QueueItem } from "@/lib/review/queue";
import { DocumentViewer, type SourceHighlight, type ViewerDocument } from "./DocumentViewer";
import { displayDate, locatorLabel } from "./format";
import { ReviewQueue } from "./ReviewQueue";
import { ValuesTable } from "./ValuesTable";

export function QuotesWorkspace({ detail, documents }: { detail: SupplierDetail; documents: ViewerDocument[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(documents[0]?.id ?? null);

  const selected = detail.values.find((v) => v.id === selectedId) ?? null;
  const highlight: SourceHighlight = useMemo(
    () => (selected ? { locator: selected.source_locator, snippet: selected.source_snippet } : null),
    [selected],
  );

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">
            {supplier.code}. {supplier.name}
          </h2>
          <p className="text-sm text-zinc-600">
            {response ? `Received ${displayDate(response.received_at)} by email` : "No response"} · GSTIN {supplier.gstin ?? "not on file"} ({supplier.state})
          </p>
        </div>
        {terms && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
            <div>
              <dt className="inline text-zinc-500">Quote date </dt>
              <dd className="inline font-medium text-zinc-900">{displayDate(terms.quote_date) || "not stated"}</dd>
            </div>
            <div>
              <dt className="inline text-zinc-500">Valid until </dt>
              <dd className="inline font-medium text-zinc-900">{displayDate(terms.valid_until) || "not stated"}</dd>
            </div>
            <div>
              <dt className="inline text-zinc-500">Freight </dt>
              <dd className="inline font-medium text-zinc-900">{terms.freight_terms ?? "not stated"}</dd>
            </div>
            <div>
              <dt className="inline text-zinc-500">Payment </dt>
              <dd className="inline font-medium text-zinc-900">{terms.payment_terms ?? "not stated"}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-2 xl:sticky xl:top-4 xl:self-start">
          <DocumentViewer documents={documents} activeId={activeDocId} onSelect={setActiveDocId} highlight={highlight} />
          {selected && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-zinc-800">
              <span className="font-medium">Source:</span> {sourceDoc?.file_name ?? "email body"}
              {locatorLabel(selected.source_locator) && `, ${locatorLabel(selected.source_locator)}`}
              {selected.source_snippet && <span className="block text-zinc-600">“{selected.source_snippet}”</span>}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <ReviewQueue
            supplierCode={supplier.code}
            supplierName={supplier.name}
            items={detail.queue}
            awaiting={detail.awaiting}
            onFocus={focusQueueItem}
          />
          <ValuesTable values={detail.values} selectedId={selectedId} onSelect={selectValue} />
        </div>
      </div>
    </div>
  );
}
