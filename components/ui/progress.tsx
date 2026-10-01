"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

// shadcn Progress, restyled: a 4px ledger bar on a hairline track.
function Progress({ className, value, tone = "ledger", ...props }: React.ComponentProps<typeof ProgressPrimitive.Root> & { tone?: "ledger" | "ink" }) {
  return (
    <ProgressPrimitive.Root data-slot="progress" value={value} className={cn("relative h-1 w-full overflow-hidden rounded-xs bg-rule", className)} {...props}>
      <ProgressPrimitive.Indicator className={cn("h-full transition-[width]", tone === "ledger" ? "bg-ledger" : "bg-ink")} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
