"use client";

import { Toaster as Sonner } from "sonner";

// Sonner toasts, bottom right, 4 seconds, in our tokens. A toast mirrors the button
// that caused it ("7 values accepted").
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      duration={4000}
      toastOptions={{
        classNames: {
          toast: "!rounded-panel !border !border-rule-strong !bg-sheet !text-ink !shadow-float !font-sans !text-body",
          description: "!text-slate !text-meta",
        },
      }}
    />
  );
}
