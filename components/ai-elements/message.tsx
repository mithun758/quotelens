import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// AI Elements Message, restyled for Lens: no bubbles, no avatars. Priya's message has a
// 2px ink rule; a briefing a 2px ledger rule; Lens's answers sit plain on the sheet.
export const Message = ({ from, className, ...props }: ComponentProps<"div"> & { from: "user" | "assistant" | "briefing" }) => (
  <div
    data-from={from}
    className={cn(
      "min-w-0 space-y-2",
      from === "user" && "border-l-2 border-ink pl-3 text-body",
      from === "briefing" && "border-l-2 border-ledger pl-3",
      className,
    )}
    {...props}
  />
);

export const MessageLabel = ({ className, ...props }: ComponentProps<"p">) => <p className={cn("text-meta font-semibold text-slate", className)} {...props} />;
