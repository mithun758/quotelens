"use client";

import Link from "next/link";
import { btn } from "./ui/styles";

// One error style everywhere, with a Retry that re-runs exactly what failed.
export function ErrorNote({ message, onRetry, busy = false }: { message: string; onRetry?: () => void; busy?: boolean }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-l-[3px] border-oxblood bg-oxblood-tint px-3 py-2 text-sm text-oxblood">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={busy} className={btn.small}>
          {busy ? "Retrying..." : "Retry"}
        </button>
      )}
    </div>
  );
}

// Shown on Comparison and Award before any quote has been extracted.
export function NotExtractedNote() {
  return (
    <div className="max-w-xl space-y-3 border-l-[3px] border-ink bg-sheet px-4 py-4">
      <h2 className="text-base font-semibold">Nothing to compare yet</h2>
      <p className="text-sm text-slate">The five supplier quotes have arrived but have not been read. Extract them on Quotes first; it takes about a minute.</p>
      <Link href="/quotes" className={btn.primary}>
        Go to Quotes
      </Link>
    </div>
  );
}
