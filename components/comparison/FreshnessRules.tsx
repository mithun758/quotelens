"use client";

import type { FreshnessResult } from "@/lib/freshness/rules";
import { displayDate } from "../quotes/format";
import { Button } from "../ui/button";
import { SidePanel } from "../ui/SidePanel";
import { Stamp } from "../ui/Stamp";

// The Quote Freshness rules that fired for one supplier, opened from its stamp. Opens
// in the Lens dock as a sheet.
export function FreshnessRules({
  supplierName,
  freshness,
  quoteDate,
  validUntil,
  onClose,
  onReconfirm,
}: {
  supplierName: string;
  freshness: FreshnessResult;
  quoteDate: string | null;
  validUntil: string | null;
  onClose: () => void;
  onReconfirm: () => void;
}) {
  const fired = freshness.rules.filter((r) => r.fired);
  return (
    <SidePanel
      title={`Quote Freshness: ${supplierName}`}
      subtitle={`Quote dated ${displayDate(quoteDate) || "not stated"}, valid until ${displayDate(validUntil) || "not stated"}`}
      onClose={onClose}
      footer={
        freshness.status !== "Fresh" ? (
          <Button variant="primary" onClick={onReconfirm}>
            Ask Lens to reconfirm
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <Stamp status={freshness.status} />
        {fired.length === 0 ? (
          <p className="text-body text-ledger">No rule fired. Safe to act on.</p>
        ) : (
          <ol className="space-y-4">
            {fired.map((r) => (
              <li key={r.key} className="flex gap-3">
                <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${r.severity === "high" ? "bg-oxblood" : "bg-amber"}`} />
                <div className="space-y-1 text-body">
                  <p>
                    <span className="font-semibold">
                      {freshness.rules.indexOf(r) + 1}. {r.label}
                    </span>{" "}
                    <span className={`text-meta font-semibold ${r.severity === "high" ? "text-oxblood" : "text-pencil"}`}>{r.severity === "high" ? "High" : "Medium"}</span>
                  </p>
                  <p className="text-meta text-slate">{r.reason}</p>
                  <p className="text-meta">Recommended: {r.action}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </SidePanel>
  );
}
