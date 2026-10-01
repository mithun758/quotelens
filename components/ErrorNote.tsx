"use client";

import { AlertCircle, Inbox } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";

// One error style everywhere: what failed and what to do, with a Retry that re-runs
// exactly what failed. Never raw error text.
export function ErrorNote({ message, onRetry, busy = false }: { message: string; onRetry?: () => void; busy?: boolean }) {
  return (
    <div role="alert" className="flex flex-wrap items-start gap-2 rounded-xs border-l-2 border-oxblood bg-oxblood-tint px-3 py-2 text-body text-oxblood">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 stroke-[1.5]" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} disabled={busy}>
          {busy ? "Retrying..." : "Retry"}
        </Button>
      )}
    </div>
  );
}

// Shown on Comparison and Award before any quote has been extracted.
export function NotExtractedNote() {
  return (
    <div className="flex max-w-xl flex-col items-start gap-3 rounded-xs border border-rule bg-sheet p-6">
      <Inbox aria-hidden className="size-6 stroke-[1.5] text-slate" />
      <div>
        <h1 className="text-heading font-semibold">Nothing to compare yet</h1>
        <p className="text-body text-slate">The supplier quotes have arrived but have not been read. Extract them on Quotes first; it takes about a minute.</p>
      </div>
      <Button asChild variant="primary">
        <Link href="/quotes">Go to Quotes</Link>
      </Button>
    </div>
  );
}
