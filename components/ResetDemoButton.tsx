"use client";

import { useState, useTransition } from "react";
import { resetDemo } from "@/app/actions/resetDemo";

export function ResetDemoButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (!window.confirm("Reset the demo? This wipes all extracted data, flags and awards and reloads the seed.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resetDemo();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-zinc-300 px-3 py-1 text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
      >
        {pending ? "Resetting..." : "Reset demo"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
