import { Skeleton } from "./ui/skeleton";

// Loading states shaped like the real screens: a title row, then the screen's main
// table, cards or document. Never a spinner alone.
function Title() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
  );
}

function Rows({ n, cols = 6 }: { n: number; cols?: number }) {
  return (
    <div className="rounded-xs border border-rule bg-sheet">
      <div className="flex gap-4 border-b-2 border-rule-strong px-3 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: n }, (_, r) => (
        <div key={r} className="flex h-9 items-center gap-4 border-b border-rule px-3 last:border-b-0">
          {Array.from({ length: cols }, (_, i) => (
            <Skeleton key={i} className={`h-3 flex-1 ${i === 0 ? "max-w-48" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ScreenSkeleton({ kind }: { kind: "table" | "cards" | "document" | "award" }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-8">
      <Title />
      {kind === "cards" && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-3 rounded-xs border border-rule bg-sheet p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-1 w-full" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      )}
      {kind === "award" && (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      {kind === "document" ? (
        <div className="mx-auto max-w-[880px] space-y-6 rounded-xs border border-rule bg-sheet p-12">
          <Skeleton className="h-7 w-2/3" />
          <div className="grid grid-cols-4 gap-6">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
          <Rows n={5} cols={5} />
        </div>
      ) : (
        <Rows n={kind === "table" ? 12 : 6} />
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}
