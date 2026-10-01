"use client";

// One error style everywhere, with a Retry that re-runs exactly what failed.
export function ErrorNote({ message, onRetry, busy = false }: { message: string; onRetry?: () => void; busy?: boolean }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={busy} className="rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50">
          {busy ? "Retrying..." : "Retry"}
        </button>
      )}
    </div>
  );
}

export function NotExtractedNote() {
  return (
    <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
      The supplier quotes have not been extracted yet, so there is nothing to compare.{" "}
      <a href="/quotes" className="font-medium underline underline-offset-2">
        Go to Quotes and extract them
      </a>{" "}
      (about a minute).
    </div>
  );
}
