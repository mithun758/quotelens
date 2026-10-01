"use client";

import { useState, useTransition } from "react";
import { decideSubstituteAction } from "@/app/(app)/comparison/actions";
import type { ComparisonCell } from "@/lib/comparison/load";
import { formatInr } from "@/lib/format/inr";
import { CONFIDENCE_LABEL, CONFIDENCE_STYLE, locatorLabel, stepText } from "../quotes/format";

const RESULT_STYLE = { meets: "text-emerald-700", exceeds: "text-emerald-700", deviates: "font-medium text-red-700" } as const;

function SubstituteDecision({ cell }: { cell: ComparisonCell }) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const decide = (decision: "approved" | "rejected") =>
    startTransition(async () => {
      setError(null);
      const r = await decideSubstituteAction(cell.id, decision, reason);
      if (!r.ok) setError(r.error);
    });

  if (cell.substitute_status === null) {
    return <p className="text-xs text-emerald-700">Meets or exceeds every attribute: an acceptable equivalent under the RFx. No sign-off needed.</p>;
  }
  if (cell.substitute_status !== "pending") {
    return (
      <p className={`text-xs font-medium ${cell.substitute_status === "approved" ? "text-emerald-700" : "text-red-700"}`}>
        Substitute {cell.substitute_status} by Arjun{cell.substitute_status === "approved" ? "; counts toward L1 and totals." : "; not counted."}
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-xs text-zinc-600">Not counted toward L1 or totals until Arjun signs off.</p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Note (required to reject)"
        aria-label="Sign-off note"
        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
      />
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => decide("approved")} className="rounded bg-emerald-700 px-2 py-1 text-xs text-white disabled:opacity-60">
          Approve substitute (Arjun)
        </button>
        <button type="button" disabled={pending} onClick={() => decide("rejected")} className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-60">
          Reject
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function CellCard({ cell, supplierName, lineLabel }: { cell: ComparisonCell; supplierName: string; lineLabel: string }) {
  return (
    <div className="w-[26rem] max-w-[85vw] space-y-2 rounded-md border border-zinc-300 bg-white p-3 text-left text-xs shadow-lg">
      <div>
        <p className="font-semibold text-zinc-900">
          {supplierName} · {lineLabel}
        </p>
        <p className="mt-0.5 flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 ${CONFIDENCE_STYLE[cell.confidence_state]}`}>{CONFIDENCE_LABEL[cell.confidence_state]}</span>
          <span className="text-sm font-medium">{cell.normalised_value_inr !== null ? formatInr(cell.normalised_value_inr) : "Not quoted"}</span>
          {cell.status === "confirmed" && <span className="text-emerald-700">Accepted by Priya</span>}
          {cell.status === "corrected" && <span className="text-emerald-700">Corrected by Priya</span>}
        </p>
      </div>
      {cell.raw_value && (
        <p className="text-zinc-700">
          As quoted: <span className="font-mono">{cell.raw_value}</span>
          {cell.raw_currency && cell.raw_currency !== "INR" ? ` ${cell.raw_currency}` : ""} {cell.raw_unit ?? ""}
        </p>
      )}
      {cell.reason && <p className="text-zinc-700">{cell.reason}</p>}
      {cell.steps.length > 0 && (
        <div>
          <p className="font-medium text-zinc-900">Normalisation ledger</p>
          <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 font-mono text-[11px]">
            {cell.steps.map((s) => (
              <li key={s.id}>{stepText(s, cell.raw_currency)}</li>
            ))}
          </ol>
        </div>
      )}
      {cell.openFlags.some((f) => !cell.reason?.includes(f.message)) && (
        <ul className="space-y-0.5">
          {cell.openFlags.filter((f) => !cell.reason?.includes(f.message)).map((f, i) => (
            <li key={i} className={f.severity === "high" ? "text-red-700" : "text-amber-800"}>
              ⚑ {f.message}
            </li>
          ))}
        </ul>
      )}
      {cell.substitute_check && (
        <div className="space-y-1 rounded border border-zinc-200 bg-zinc-50 p-2">
          <p className="font-medium text-zinc-900">{cell.substitute_status === null ? "Equivalent model: attribute check" : "Substitute model: attribute check"}</p>
          <table className="w-full">
            <tbody>
              {cell.substitute_check.map((c) => (
                <tr key={c.attribute}>
                  <td className="pr-2 text-zinc-600">{c.attribute}</td>
                  <td className="pr-2">required {String(c.required)}</td>
                  <td className="pr-2">offered {String(c.offered)}</td>
                  <td className={RESULT_STYLE[c.result]}>{c.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <SubstituteDecision cell={cell} />
        </div>
      )}
      {cell.source_snippet && (
        <p className="border-t border-zinc-100 pt-2 text-zinc-600">
          Source: {cell.documentName ?? "email"}
          {locatorLabel(cell.source_locator) ? `, ${locatorLabel(cell.source_locator)}` : ""}
          <span className="block text-zinc-800">“{cell.source_snippet}”</span>
        </p>
      )}
    </div>
  );
}
