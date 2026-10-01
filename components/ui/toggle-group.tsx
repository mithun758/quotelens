"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

// shadcn Toggle Group, restyled as a segmented control: hairline frame, the chosen
// segment filled in ink. Single choice only.
function ToggleGroup({ className, size = "default", ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & { size?: "default" | "sm" }) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-size={size}
      className={cn("group/toggle inline-flex w-fit items-stretch rounded-xs border border-slate bg-sheet", className)}
      {...props}
    />
  );
}

function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex items-center gap-1.5 border-l border-slate px-3 whitespace-nowrap text-ink first:border-l-0 hover:bg-tint focus-visible:z-10 disabled:cursor-not-allowed disabled:opacity-45",
        "h-[30px] text-body group-data-[size=sm]/toggle:h-[26px] group-data-[size=sm]/toggle:px-2 group-data-[size=sm]/toggle:text-meta",
        "data-[state=on]:bg-ink data-[state=on]:font-semibold data-[state=on]:text-white",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
