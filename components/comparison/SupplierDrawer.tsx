"use client";

import Link from "next/link";
import { totalFor, type BasketMode } from "@/lib/comparison/build";
import type { ComparisonView } from "@/lib/comparison/load";
import { formatInrCompact } from "@/lib/format/inr";
import { displayDate } from "../quotes/format";
import { SidePanel } from "../ui/SidePanel";
import { Stamp } from "../ui/Stamp";

// Supplier details and the Quote Freshness rules, in the right-hand panel.
export function SupplierPanel({ view, code, mode, onClose }: { view: ComparisonView; code: string; mode: BasketMode; onClose: () => void }) {
  const supplier = view.suppliers.find((s) => s.code === code)!;
  const freshness = view.freshness[code];
  const totals = view.result.suppliers.find((s) => s.code === code)!;
  const terms = view.terms[code];
  const fields: [string, string][] = [
    ["Quote date", displayDate(terms?.quoteDate) || "Not stated"],
    ["Valid until", displayDate(terms?.validUntil) || "Not stated"],
    ["Lines counted", `${totals.countable} of ${view.lines.length}`],
    [mode === "common" ? "Common basket total" : "All lines total", formatInrCompact(totalFor(totals, mode))],
    ["Questionnaire", `${supplier.questionnairePassed} of ${supplier.questionnaireTotal} passed`],
    ["Freight", terms?.freight ?? "Not stated"],
    ["GSTIN", `${supplier.gstin} (${supplier.state})`],
  ];

  return (
    <SidePanel title={`${supplier.code}. ${supplier.name}`} subtitle={supplier.is_incumbent ? "Incumbent" : undefined} onClose={onClose}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {fields.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-slate">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-5 border-t border-rule pt-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Quote Freshness</h4>
          {freshness ? <Stamp status={freshness.status} /> : <span className="text-xs text-slate">Not extracted yet</span>}
        </div>
        <p className="mt-1 text-xs text-slate">Can Priya still rely on this quote? Checked as of the as-of date, with {view.approvalDays} days for approval. Benchmarks and FX are illustrative.</p>
        {freshness && (
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {freshness.rules.map((r) => (
              <li key={r.key} className={`py-2 pl-3 text-sm ${r.fired ? `border-l-2 ${r.severity === "high" ? "border-oxblood" : "border-amber"}` : "border-l-2 border-transparent"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={r.fired ? "font-semibold" : "text-slate"}>{r.label}</span>
                  <span className={`text-xs ${r.fired ? (r.severity === "high" ? "font-semibold text-oxblood" : "font-semibold text-pencil") : "text-slate"}`}>
                    {r.fired ? (r.severity === "high" ? "Fired, high" : "Fired, medium") : "Not fired"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate">{r.reason}</p>
                {r.fired && <p className="mt-1 text-xs">Recommended: {r.action}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href={`/quotes?supplier=${supplier.code}`} className="mt-4 inline-block text-sm font-semibold underline decoration-rule underline-offset-4 hover:decoration-ink">
        Open documents and review queue
      </Link>
    </SidePanel>
  );
}
