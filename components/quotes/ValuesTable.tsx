"use client";

import type { ValueWithLine } from "@/lib/quotes/load";
import { Value } from "../ui/Value";
import { inr, locatorLabel, stepText } from "./format";

function Detail({ v }: { v: ValueWithLine }) {
  return (
    <div className="space-y-2 border-l-[3px] border-ink bg-paper px-3 py-2 text-xs">
      {v.reason && <p className="text-pencil">{v.reason}</p>}
      {v.match_reason && <p className="text-slate">Mapped to this line: {v.match_reason}</p>}
      {v.steps.length > 0 && (
        <div>
          <p className="font-semibold">Normalisation ledger</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            {v.steps.map((s) => (
              <li key={s.id}>{stepText(s, v.raw_currency)}</li>
            ))}
          </ol>
        </div>
      )}
      {v.substitute_check && (
        <div>
          <p className="font-semibold">Substitute check, {v.substitute_status === "pending" ? "awaiting Arjun's sign-off" : v.substitute_status ?? "no sign-off needed"}</p>
          <ul className="mt-1 space-y-0.5">
            {v.substitute_check.map((c) => (
              <li key={c.attribute}>
                <span className={c.result === "deviates" ? "font-semibold text-oxblood" : "text-ledger"}>{c.result === "deviates" ? "Deviates" : c.result === "exceeds" ? "Exceeds" : "Meets"}</span> {c.attribute.replace(/_/g, " ")}: required {String(c.required)}, offered{" "}
                {String(c.offered)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {v.source_snippet && (
        <p className="text-slate">
          Source{locatorLabel(v.source_locator) ? `, ${locatorLabel(v.source_locator)}` : ""}: “{v.source_snippet}”
        </p>
      )}
    </div>
  );
}

const REVIEW: Record<string, string> = { confirmed: "Accepted", corrected: "Corrected" };

export function ValuesTable({ values, selectedId, onSelect, settled }: { values: ValueWithLine[]; selectedId: string | null; onSelect: (id: string) => void; settled: { ids: string[]; n: number } }) {
  const rows = [...values.filter((v) => v.field === "unit_price"), ...values.filter((v) => v.field === "unmatched_item")];
  return (
    <section aria-label="Extracted values">
      <div className="border-b border-ink pb-1">
        <h2 className="text-base font-semibold">Extracted values</h2>
        <p className="text-xs text-slate">₹ per piece, ex-GST, delivered. Select a row for its source and ledger.</p>
      </div>
      <table className="w-full table-fixed border-collapse text-[13px]">
        <colgroup>
          <col className="w-9" />
          <col />
          <col className="w-[6.5rem]" />
          <col className="w-[5.5rem]" />
        </colgroup>
        <thead>
          <tr className="text-xs text-slate">
            <th className="border-b border-rule py-1 text-right font-semibold">Line</th>
            <th className="border-b border-rule px-3 py-1 text-left font-semibold">As quoted</th>
            <th className="border-b border-rule py-1 text-right font-semibold">Normalised</th>
            <th className="border-b border-rule py-1 text-right font-semibold">Review</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const selected = v.id === selectedId;
            return (
              <tr key={settled.ids.includes(v.id) ? `${v.id}-${settled.n}` : v.id} className={`align-top ${settled.ids.includes(v.id) ? "settle" : ""}`}>
                <td colSpan={4} className="border-b border-rule p-0">
                  <button
                    type="button"
                    onClick={() => onSelect(v.id)}
                    aria-expanded={selected}
                    className={`grid min-h-9 w-full grid-cols-[2.25rem_1fr_6.5rem_5.5rem] items-center text-left hover:bg-tint ${selected ? "bg-tint" : ""}`}
                  >
                    <span className="text-right text-xs text-slate">{v.line_no ?? ""}</span>
                    <span className="min-w-0 px-3 py-1">
                      <span className="block truncate text-xs text-slate">{v.description ?? "Matches no RFx line"}</span>
                      <span className="block truncate">
                        {v.raw_value ?? <span className="text-slate">Not quoted</span>}
                        {v.raw_currency && v.raw_currency !== "INR" ? ` ${v.raw_currency}` : ""}
                        {v.raw_unit && v.raw_unit !== "per piece" ? <span className="text-slate"> {v.raw_unit}</span> : null}
                      </span>
                    </span>
                    <span className="text-right">
                      {v.normalised_value_inr !== null ? (
                        <Value state={v.confidence_state} reason={v.reason}>
                          {inr(v.normalised_value_inr)}
                        </Value>
                      ) : (
                        <Value state="missing" reason={v.reason} />
                      )}
                    </span>
                    <span className={`text-right text-xs ${REVIEW[v.status] ? "text-ledger" : "text-slate"}`}>{REVIEW[v.status] ?? (v.status === "needs_review" ? "To review" : "")}</span>
                  </button>
                  {selected && <Detail v={v} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
