"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { encodeLocator } from "@/lib/ai/lens/citations";
import type { ComparisonCell } from "@/lib/comparison/load";
import { formatInr } from "@/lib/format/inr";
import { displayDate, locatorLabel, revisionOf, stepText } from "../quotes/format";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Value } from "../ui/Value";

const CONFIDENCE = { extracted: "Extracted", inferred: "Inferred", missing: "Missing" } as const;
const STEP: Record<string, string> = { fx: "Currency", uom: "Unit", pack_size: "Pack size", gst: "GST", discount: "Discount", freight: "Freight", bundle: "Bundle", revision: "Revision" };

// One cell's value, source and normalisation ledger, shown on hover or when pinned.
export function CellCard({ cell, supplierName, lineLabel, onOpenSubstitute }: { cell: ComparisonCell; supplierName: string; lineLabel: string; onOpenSubstitute?: () => void }) {
  const flags = cell.openFlags.filter((f) => !cell.reason?.includes(f.message));
  const rev = revisionOf(cell.steps);
  const reviewed = cell.status === "confirmed" || cell.status === "corrected";
  return (
    <div className="space-y-3 text-meta">
      <div>
        <p className="text-body font-semibold">{supplierName}</p>
        <p className="text-slate">{lineLabel}</p>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-slate">Unit price, ₹ per piece</p>
          <p className="text-heading font-semibold">
            {cell.normalised_value_inr !== null ? (
              <Value state={cell.confidence_state} reason={cell.reason} revised={rev ? { was: formatInr(Number(rev.input)), date: displayDate(rev.rate_date), why: rev.rate_source } : null}>
                {formatInr(cell.normalised_value_inr)}
              </Value>
            ) : (
              <span className="text-body font-normal text-slate">Not quoted</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={cell.confidence_state === "extracted" ? "neutral" : cell.confidence_state === "inferred" ? "pencil" : "oxblood"}>{CONFIDENCE[cell.confidence_state]}</Badge>
          <span className={reviewed ? "text-ledger" : "text-slate"}>
            {cell.status === "confirmed" ? "Accepted by Priya" : cell.status === "corrected" ? "Corrected by Priya" : cell.status === "needs_review" ? "Needs review" : "No review needed"}
          </span>
        </div>
      </div>

      {cell.reason && <p className="text-pencil">{cell.reason}</p>}

      {cell.source_snippet && (
        <figure className="border-l-2 border-rule-strong pl-2">
          <blockquote className="text-ink">“{cell.source_snippet}”</blockquote>
          <figcaption className="mt-1 text-slate">
            {cell.documentName ?? "Email"}
            {locatorLabel(cell.source_locator) ? `, ${locatorLabel(cell.source_locator)}` : ""}
            {cell.raw_value ? `. Quoted as ${cell.raw_value}${cell.raw_currency && cell.raw_currency !== "INR" ? ` ${cell.raw_currency}` : ""}${cell.raw_unit ? ` ${cell.raw_unit}` : ""}` : ""}
          </figcaption>
        </figure>
      )}

      {cell.steps.length > 0 && (
        <table className="w-full border-collapse">
          <caption className="pb-1 text-left font-semibold">Normalisation ledger</caption>
          <tbody>
            {cell.steps.map((s) => (
              <tr key={s.id} className="border-t border-rule align-top">
                <th scope="row" className="w-20 py-1 pr-2 text-left font-normal text-slate">
                  {STEP[s.kind] ?? s.kind}
                </th>
                <td className="py-1">{stepText(s, cell.raw_currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {flags.length > 0 && (
        <ul className="space-y-1">
          {flags.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <span aria-hidden className={`mt-[5px] size-1.5 shrink-0 rounded-full ${f.severity === "high" ? "bg-oxblood" : "bg-amber"}`} />
              <span>
                <span className="sr-only">{f.severity === "high" ? "High" : "Medium"} flag: </span>
                {f.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      {cell.substitute_check && (
        <div className="flex items-center justify-between gap-2 border-t border-rule pt-2">
          <span>
            {cell.substitute_status === null
              ? "Equivalent model: meets or exceeds every attribute."
              : cell.substitute_status === "pending"
                ? "Substitute model awaiting Arjun's sign-off; not counted."
                : `Substitute ${cell.substitute_status} by Arjun.`}
          </span>
          {cell.substitute_status !== null && onOpenSubstitute && (
            <Button size="sm" variant="outline" onClick={onOpenSubstitute}>
              {cell.substitute_status === "pending" ? "Review substitute" : "View sign-off"}
            </Button>
          )}
        </div>
      )}

      {cell.source_document_id && (
        <div className="border-t border-rule pt-2">
          <Link
            href={`/quotes?doc=${cell.source_document_id}&loc=${encodeURIComponent(encodeLocator(cell.source_locator))}#exceptions`}
            className="inline-flex items-center gap-1 font-semibold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
          >
            Open source
            <ExternalLink aria-hidden className="size-3.5 stroke-[1.5]" />
          </Link>
        </div>
      )}
    </div>
  );
}
