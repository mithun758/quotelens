"use client";

import type { ComparisonCell } from "@/lib/comparison/load";
import { formatInr } from "@/lib/format/inr";
import { locatorLabel, stepText } from "../quotes/format";
import { btn } from "../ui/styles";
import { Value } from "../ui/Value";

const CONFIDENCE = { extracted: "Extracted", inferred: "Inferred", missing: "Missing" } as const;

// Source, ledger and flags for one cell, shown on hover or when pinned.
export function CellCard({ cell, supplierName, lineLabel, onOpenSubstitute }: { cell: ComparisonCell; supplierName: string; lineLabel: string; onOpenSubstitute?: () => void }) {
  const flags = cell.openFlags.filter((f) => !cell.reason?.includes(f.message));
  return (
    <div className="w-[26rem] max-w-[85vw] space-y-2 rounded-xs border border-rule bg-sheet p-3 text-left text-xs shadow-[0_8px_24px_rgb(27_42_65/0.14)]">
      <div>
        <p className="font-semibold">{supplierName}</p>
        <p className="text-slate">{lineLabel}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <div>
          <dt className="text-slate">Unit price</dt>
          <dd className="text-sm font-semibold">
            {cell.normalised_value_inr !== null ? (
              <Value state={cell.confidence_state} reason={cell.reason}>
                {formatInr(cell.normalised_value_inr)}
              </Value>
            ) : (
              "Not quoted"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate">Confidence</dt>
          <dd>{CONFIDENCE[cell.confidence_state]}</dd>
        </div>
        <div>
          <dt className="text-slate">Review</dt>
          <dd className={cell.status === "confirmed" || cell.status === "corrected" ? "text-ledger" : ""}>
            {cell.status === "confirmed" ? "Accepted by Priya" : cell.status === "corrected" ? "Corrected by Priya" : cell.status === "needs_review" ? "Needs review" : "Not needed"}
          </dd>
        </div>
      </dl>
      {cell.raw_value && (
        <p>
          <span className="text-slate">As quoted </span>
          {cell.raw_value}
          {cell.raw_currency && cell.raw_currency !== "INR" ? ` ${cell.raw_currency}` : ""} {cell.raw_unit ?? ""}
        </p>
      )}
      {cell.reason && <p className="text-pencil">{cell.reason}</p>}
      {cell.steps.length > 0 && (
        <div>
          <p className="font-semibold">Normalisation ledger</p>
          <ol className="mt-0.5 list-decimal space-y-0.5 pl-4">
            {cell.steps.map((s) => (
              <li key={s.id}>{stepText(s, cell.raw_currency)}</li>
            ))}
          </ol>
        </div>
      )}
      {flags.length > 0 && (
        <ul className="space-y-0.5">
          {flags.map((f, i) => (
            <li key={i} className={f.severity === "high" ? "text-oxblood" : "text-pencil"}>
              {f.message}
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
            <button type="button" onClick={onOpenSubstitute} className={btn.small}>
              {cell.substitute_status === "pending" ? "Review substitute" : "View sign-off"}
            </button>
          )}
        </div>
      )}
      {cell.source_snippet && (
        <p className="border-t border-rule pt-2">
          <span className="text-slate">
            Source: {cell.documentName ?? "email"}
            {locatorLabel(cell.source_locator) ? `, ${locatorLabel(cell.source_locator)}` : ""}
          </span>
          <span className="block">“{cell.source_snippet}”</span>
        </p>
      )}
    </div>
  );
}
