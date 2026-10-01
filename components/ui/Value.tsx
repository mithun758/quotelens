import type { ReactNode } from "react";
import type { ConfidenceState } from "@/lib/db/types";

// Confidence shown in the type itself. Extracted is solid ink; Inferred is pencil
// amber with a dotted underline and its reason on hover or focus; Missing is an
// empty hatched space, never a zero.
export function Value({ state, reason, children, className = "" }: { state: ConfidenceState | null | undefined; reason?: string | null; children?: ReactNode; className?: string }) {
  if (state === "missing") {
    return (
      <span className={`val-missing inline-block h-[18px] w-full min-w-10 align-middle ${className}`} title={reason ?? "Not quoted"}>
        <span className="sr-only">Not quoted{reason ? `: ${reason}` : ""}</span>
      </span>
    );
  }
  if (state === "inferred") {
    return (
      <span tabIndex={0} className={`has-tip val-inferred ${className}`}>
        {children}
        <span className="sr-only">, Inferred{reason ? `: ${reason}` : ""}</span>
        <span className="tip" aria-hidden="true">
          <span className="font-semibold text-pencil">Inferred.</span> {reason ?? "A judgement or code-derived conversion; check before relying on it."}
        </span>
      </span>
    );
  }
  return <span className={className}>{children}</span>;
}

