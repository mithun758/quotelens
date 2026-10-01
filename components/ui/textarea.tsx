import type * as React from "react";
import { cn } from "@/lib/utils";

// shadcn Textarea, restyled: 1px slate border, 2px radius.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn("w-full rounded-xs border border-slate bg-sheet px-2 py-1.5 text-body text-ink placeholder:text-slate disabled:opacity-45", className)} {...props} />;
}

export { Textarea };
