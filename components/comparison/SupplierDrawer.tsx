"use client";

import Link from "next/link";
import { useEffect } from "react";
import { totalFor, type BasketMode } from "@/lib/comparison/build";
import type { ComparisonView } from "@/lib/comparison/load";
import { formatInrCompact } from "@/lib/format/inr";
import type { FreshnessStatus } from "@/lib/freshness/rules";
import { displayDate } from "../quotes/format";

const STATUS_STYLE: Record<FreshnessStatus, string> = {
  Fresh: "bg-emerald-100 text-emerald-900",
  Reconfirm: "bg-amber-100 text-amber-900",
  Stale: "bg-red-100 text-red-800",
};

export function FreshnessBadge({ status }: { status: FreshnessStatus }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{status}</span>;
}

export function SupplierDrawer({ view, code, mode, onClose }: { view: ComparisonView; code: string; mode: BasketMode; onClose: () => void }) {
  const supplier = view.suppliers.find((s) => s.code === code)!;
  const freshness = view.freshness[code];
  const totals = view.result.suppliers.find((s) => s.code === code)!;
  const terms = view.terms[code];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-zinc-900/20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={`${supplier.name} details`} className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">
              {supplier.code}. {supplier.name}
            </h3>
            <p className="text-sm text-zinc-600">
              {supplier.is_incumbent ? "Incumbent · " : ""}GSTIN {supplier.gstin} ({supplier.state})
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-100" aria-label="Close">
            Close
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">Quote date</dt>
            <dd>{displayDate(terms?.quoteDate) || "Not stated"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Valid until</dt>
            <dd>{displayDate(terms?.validUntil) || "Not stated"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Coverage counted</dt>
            <dd>
              {totals.countable}/{view.lines.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{mode === "common" ? "Common basket total" : "All lines total"}</dt>
            <dd>{formatInrCompact(totalFor(totals, mode))}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Questionnaire</dt>
            <dd>
              {supplier.questionnairePassed}/{supplier.questionnaireTotal} passed
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Freight</dt>
            <dd>{terms?.freight ?? "Not stated"}</dd>
          </div>
        </dl>

        <section className="mt-5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Quote Freshness</h4>
            {freshness ? <FreshnessBadge status={freshness.status} /> : <span className="text-xs text-zinc-500">Not extracted yet</span>}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Can Priya still rely on this quote today? As of the as-of date, with {view.approvalDays} days for approval. Benchmarks and FX are illustrative.
          </p>
          {freshness && (
            <ul className="mt-3 space-y-2">
              {freshness.rules.map((r) => (
                <li key={r.key} className={`rounded-md border p-2 text-sm ${r.fired ? (r.severity === "high" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50") : "border-zinc-200"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.label}</span>
                    <span className={`text-xs font-medium ${r.fired ? (r.severity === "high" ? "text-red-800" : "text-amber-900") : "text-zinc-500"}`}>
                      {r.fired ? `Fired · ${r.severity === "high" ? "High" : "Medium"}` : "Not fired"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-700">{r.reason}</p>
                  {r.fired && <p className="mt-1 text-xs font-medium text-zinc-900">Recommended: {r.action}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link href={`/quotes?supplier=${supplier.code}`} className="mt-5 inline-block text-sm text-zinc-800 underline underline-offset-2">
          Open documents and review queue
        </Link>
      </aside>
    </div>
  );
}
