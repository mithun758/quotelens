"use client";

import { useState, useTransition } from "react";
import { runExtraction } from "./actions";

export function RunExtractionButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await runExtraction();
            setMessage(
              result.ok
                ? `Extraction finished in ${result.seconds}s for $${result.costUsd.toFixed(2)}.${result.errors.length ? ` Failed: ${result.errors.join("; ")}` : ""}`
                : result.error,
            );
          })
        }
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
      >
        {pending ? "Extracting all five suppliers..." : "Run extraction"}
      </button>
      {message && <span className="text-sm text-zinc-600">{message}</span>}
    </div>
  );
}
