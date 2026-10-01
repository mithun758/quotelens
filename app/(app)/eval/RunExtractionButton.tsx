"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runExtraction } from "./actions";

export function RunExtractionButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2 @4xl:items-end">
      <Button
        variant="primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await runExtraction();
            if (!result.ok) return setError(result.error);
            toast(`Extraction finished in ${result.seconds}s for $${result.costUsd.toFixed(2)}`, { description: result.errors.length ? `Failed: ${result.errors.join("; ")}` : undefined });
          })
        }
      >
        {pending ? "Extracting all five suppliers..." : "Re-run extraction"}
      </Button>
      {pending && <span className="text-meta text-slate">Reading every supplier&apos;s documents. It takes about a minute.</span>}
      {error && (
        <span role="alert" className="text-meta text-oxblood">
          {error}
        </span>
      )}
    </div>
  );
}
