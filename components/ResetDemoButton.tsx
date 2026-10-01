"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetDemo } from "@/app/actions/resetDemo";
import { LENS_KEYS } from "./lens/LensProvider";
import { btn } from "./ui/styles";

export function ResetDemoButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function onClick() {
    if (
      !window.confirm(
        "Reset the demo? Supplier quotes go back to received (extract them again on Quotes, about a minute), and all decisions, clarifications, the award and the RFx draft are cleared.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resetDemo();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Reset also clears the Lens conversation and its briefing memory.
      try {
        sessionStorage.removeItem(LENS_KEYS.conversation);
        sessionStorage.removeItem(LENS_KEYS.briefed);
      } catch {
        // Storage may be unavailable; nothing to clear then.
      }
      window.dispatchEvent(new Event("quotelens:reset"));
      router.push("/quotes");
    });
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={btn.secondary}
      >
        {pending ? "Resetting..." : "Reset demo"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-oxblood">
          {error}
        </span>
      )}
    </span>
  );
}
