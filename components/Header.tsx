import Link from "next/link";
import { asOfDate, formatDisplayDate } from "@/lib/config";
import type { Progress } from "@/lib/nav/progress";
import { ResetDemoButton } from "./ResetDemoButton";

export function Header({ progress }: { progress: Progress | null }) {
  const blockers = progress?.awardBlockers ?? null;
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-sheet">
      <div className="flex h-14 items-center gap-6 px-5">
        <Link href="/quotes" className="w-[176px] shrink-0 text-sm font-semibold tracking-tight">
          QuoteLens
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-5">{progress?.rfxTitle ?? "RFx"}</p>
          <p className="text-xs text-slate">Meridian Diagnostics</p>
        </div>
        <dl className="flex items-center gap-6 text-sm">
          <div>
            <dt className="text-xs text-slate">As of</dt>
            <dd className="font-semibold leading-5">{formatDisplayDate(asOfDate())}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Award blockers</dt>
            <dd className="leading-5">
              {blockers === null ? (
                <span className="text-slate">Not yet</span>
              ) : (
                <Link href="/award" className={`font-semibold underline decoration-rule underline-offset-4 hover:decoration-current ${blockers ? "text-oxblood" : "text-ledger"}`}>
                  {blockers ? blockers : "None"}
                </Link>
              )}
            </dd>
          </div>
        </dl>
        <ResetDemoButton />
      </div>
    </header>
  );
}
