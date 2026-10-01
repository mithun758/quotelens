"use client";

import type { NormalisationStepRow } from "@/lib/db/types";
import type { ValueWithLine } from "@/lib/quotes/load";
import { CONFIDENCE_LABEL, CONFIDENCE_STYLE, displayDate, inr, locatorLabel } from "./format";

export function stepText(s: NormalisationStepRow, currency: string | null): string {
  const date = s.rate_date ? `, ${displayDate(s.rate_date)}` : "";
  switch (s.kind) {
    case "fx":
      return `${currency ?? ""} ${Number(s.input).toFixed(2)} × ${s.rate} (${s.rate_source}${date}) = ${inr(s.output)}`;
    case "bundle":
      return `${inr(s.input)} − ${inr(s.rate)} (${s.rate_source}) = ${inr(s.output)}`;
    default:
      return `${inr(s.input)} ÷ ${s.rate} (${s.rate_source}) = ${inr(s.output)}`;
  }
}

function StatusTag({ status }: { status: ValueWithLine["status"] }) {
  if (status === "confirmed") return <span className="text-xs text-emerald-700">Accepted</span>;
  if (status === "corrected") return <span className="text-xs text-emerald-700">Corrected</span>;
  return null;
}

function Detail({ v }: { v: ValueWithLine }) {
  return (
    <div className="space-y-2 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
      {v.reason && <p>{v.reason}</p>}
      {v.match_reason && <p className="text-zinc-500">Mapped to this line: {v.match_reason}</p>}
      {v.steps.length > 0 && (
        <div>
          <p className="font-medium text-zinc-800">Normalisation ledger</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 font-mono">
            {v.steps.map((s) => (
              <li key={s.id}>{stepText(s, v.raw_currency)}</li>
            ))}
          </ol>
        </div>
      )}
      {v.substitute_check && (
        <div>
          <p className="font-medium text-zinc-800">Substitute check ({v.substitute_status === "pending" ? "awaiting Arjun's sign-off" : v.substitute_status})</p>
          <ul className="mt-1 space-y-0.5">
            {v.substitute_check.map((c) => (
              <li key={c.attribute}>
                <span className={c.result === "deviates" ? "font-medium text-red-700" : "text-emerald-700"}>{c.result}</span> {c.attribute}: required{" "}
                {String(c.required)}, offered {String(c.offered)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {v.source_snippet && (
        <p className="text-zinc-500">
          Source{locatorLabel(v.source_locator) ? ` (${locatorLabel(v.source_locator)})` : ""}: “{v.source_snippet}”
        </p>
      )}
    </div>
  );
}

export function ValuesTable({ values, selectedId, onSelect }: { values: ValueWithLine[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const prices = values.filter((v) => v.field === "unit_price");
  const unmatched = values.filter((v) => v.field === "unmatched_item");
  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-3 py-2">
        <h3 className="text-sm font-semibold">Extracted values</h3>
        <p className="text-xs text-zinc-500">INR per piece, ex-GST, delivered. Click a value to see its source and ledger.</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="px-2 py-1 text-left">Line</th>
            <th className="px-2 py-1 text-left">As quoted</th>
            <th className="px-2 py-1 text-right">Normalised</th>
            <th className="px-2 py-1 text-right">State</th>
          </tr>
        </thead>
        <tbody>
          {[...prices, ...unmatched].map((v) => {
            const selected = v.id === selectedId;
            return (
              <tr key={v.id} className="border-t border-zinc-100 align-top">
                <td colSpan={4} className="p-0">
                  <button
                    type="button"
                    onClick={() => onSelect(v.id)}
                    aria-expanded={selected}
                    className={`grid w-full grid-cols-[3rem_1fr_7rem_6.5rem] gap-2 px-2 py-1.5 text-left hover:bg-zinc-50 ${selected ? "bg-amber-50" : ""}`}
                  >
                    <span className="text-zinc-500">{v.line_no ?? "?"}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-zinc-500">{v.description ?? "Matches no RFx line"}</span>
                      <span className="block truncate">
                        {v.raw_value ?? <span className="text-zinc-400">Not quoted</span>}
                        {v.raw_currency && v.raw_currency !== "INR" ? ` ${v.raw_currency}` : ""}
                        {v.raw_unit && v.raw_unit !== "per piece" ? <span className="text-zinc-500"> {v.raw_unit}</span> : null}
                      </span>
                    </span>
                    <span className="text-right font-medium">{inr(v.normalised_value_inr)}</span>
                    <span className="flex flex-col items-end gap-0.5">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${CONFIDENCE_STYLE[v.confidence_state]}`}>{CONFIDENCE_LABEL[v.confidence_state]}</span>
                      <StatusTag status={v.status} />
                    </span>
                  </button>
                  {selected && <Detail v={v} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
