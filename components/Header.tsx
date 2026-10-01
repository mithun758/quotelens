import Link from "next/link";
import { asOfDate, formatDisplayDate } from "@/lib/config";
import type { EventStatus, Progress } from "@/lib/nav/progress";
import { CommandBar } from "./CommandBar";
import { ResetDemoButton } from "./ResetDemoButton";
import { Badge } from "./ui/badge";

const STATUS_TONE: Record<EventStatus, "neutral" | "pencil" | "ink" | "ledger"> = {
  Draft: "neutral",
  "Collecting quotes": "pencil",
  Evaluating: "ink",
  "Sent for approval": "ledger",
};

// The top bar on every screen: who, which event and where it stands, the as-of date,
// what blocks the award, search, and Reset demo.
export function Header({ progress }: { progress: Progress | null }) {
  const blockers = progress?.awardBlockers ?? null;
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-sheet">
      <div className="flex h-14 items-center gap-6 px-6">
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/quotes" className="text-heading font-semibold text-ink">
            QuoteLens
          </Link>
          <span aria-hidden className="h-5 w-px bg-rule" />
          <span className="text-body text-slate">Meridian Diagnostics</span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <p className="truncate text-body font-semibold">{progress?.rfxTitle ?? "RFx"}</p>
          {progress && <Badge variant={STATUS_TONE[progress.status]}>{progress.status}</Badge>}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <span className="text-meta text-slate">As of {formatDisplayDate(asOfDate())}</span>
          {blockers === null ? (
            <span className="flex items-center gap-1.5 text-meta text-slate">
              Award blockers <Badge>Not yet</Badge>
            </span>
          ) : (
            <Link href="/award#readiness" className="flex items-center gap-1.5 rounded-xs text-meta text-slate hover:text-ink">
              Award blockers
              <Badge variant={blockers ? "oxblood" : "ledger"} className="font-semibold">
                {blockers}
                <span className="sr-only">{blockers === 1 ? " blocker" : " blockers"}</span>
              </Badge>
            </Link>
          )}
          {progress && <CommandBar search={progress.search} steps={progress.steps} />}
          <ResetDemoButton />
        </div>
      </div>
    </header>
  );
}
