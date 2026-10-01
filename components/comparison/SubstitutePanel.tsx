"use client";

import { useState, useTransition } from "react";
import { decideSubstituteAction } from "@/app/(app)/comparison/actions";
import type { ComparisonCell } from "@/lib/comparison/load";
import { formatInr } from "@/lib/format/inr";
import { ErrorNote } from "../ErrorNote";
import { SidePanel } from "../ui/SidePanel";
import { btn, input } from "../ui/styles";
import { Value } from "../ui/Value";

const RESULT = {
  meets: { label: "Meets", tone: "text-ledger" },
  exceeds: { label: "Exceeds", tone: "text-ledger" },
  deviates: { label: "Deviates", tone: "font-semibold text-oxblood" },
} as const;

// Arjun's sign-off on a substitute model: the attribute comparison, then a decision.
export function SubstitutePanel({ cell, supplierName, lineLabel, onClose }: { cell: ComparisonCell; supplierName: string; lineLabel: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const decide = (decision: "approved" | "rejected") =>
    startTransition(async () => {
      setError(null);
      const r = await decideSubstituteAction(cell.id, decision, note);
      if (!r.ok) setError(r.error);
    });
  const status = cell.substitute_status;
  const deviations = cell.substitute_check?.filter((c) => c.result === "deviates").length ?? 0;

  return (
    <SidePanel
      title="Substitute sign-off"
      subtitle={`${supplierName}, ${lineLabel}`}
      onClose={onClose}
      footer={
        status === "pending" ? (
          <div className="space-y-2">
            <label className="block text-xs text-slate" htmlFor="signoff-note">
              Note from Arjun (required to reject)
            </label>
            <input id="signoff-note" value={note} onChange={(e) => setNote(e.target.value)} className={`${input} w-full`} />
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => decide("approved")} className={btn.primary}>
                {pending ? "Saving..." : "Approve substitute"}
              </button>
              <button type="button" disabled={pending || note.trim().length === 0} onClick={() => decide("rejected")} className={btn.secondary}>
                Reject
              </button>
            </div>
            {error && <ErrorNote message={error} />}
          </div>
        ) : undefined
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-slate">Unit price</dt>
          <dd className="font-semibold">
            <Value state={cell.confidence_state} reason={cell.reason}>
              {formatInr(cell.normalised_value_inr)}
            </Value>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate">Status</dt>
          <dd className={status === "approved" ? "text-ledger" : status === "rejected" ? "text-oxblood" : ""}>
            {status === "pending" ? "Awaiting Arjun" : status === "approved" ? "Approved by Arjun" : status === "rejected" ? "Rejected by Arjun" : "No sign-off needed"}
          </dd>
        </div>
      </dl>
      {cell.source_snippet && (
        <blockquote className="mt-4 border-l-2 border-rule pl-3 text-sm">
          <span className="block text-xs text-slate">Offered in {cell.documentName ?? "the email"}</span>“{cell.source_snippet}”
        </blockquote>
      )}
      {cell.substitute_check && (
        <table className="mt-4 w-full border-collapse text-table">
          <caption className="pb-1 text-left text-sm font-semibold">
            Attribute check{deviations ? `: ${deviations} deviation${deviations === 1 ? "" : "s"}` : ""}
          </caption>
          <thead>
            <tr className="text-xs text-slate">
              <th className="border-b-2 border-rule-strong py-1 pr-2 text-left font-semibold">Attribute</th>
              <th className="border-b-2 border-rule-strong py-1 pr-2 text-left font-semibold">Required</th>
              <th className="border-b-2 border-rule-strong py-1 pr-2 text-left font-semibold">Offered</th>
              <th className="border-b-2 border-rule-strong py-1 text-left font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {cell.substitute_check.map((c) => (
              <tr key={c.attribute} className={c.result === "deviates" ? "bg-oxblood-tint" : ""}>
                <td className="h-9 border-b border-rule pr-2">{c.attribute.replace(/_/g, " ")}</td>
                <td className="border-b border-rule pr-2">{String(c.required)}</td>
                <td className="border-b border-rule pr-2">{String(c.offered)}</td>
                <td className={`border-b border-rule ${RESULT[c.result].tone}`}>{RESULT[c.result].label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-slate">
        {status === "pending" ? "Not counted toward L1 or totals until Arjun signs off." : status === "approved" ? "Counts toward L1 and totals." : status === "rejected" ? "Not counted." : ""}
      </p>
    </SidePanel>
  );
}
