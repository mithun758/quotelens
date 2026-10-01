"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

// AI Elements Suggestion, restyled: small outline buttons that wrap, never pills.
export const Suggestions = ({ className, ...props }: ComponentProps<"div">) => <div className={cn("flex flex-wrap gap-2", className)} {...props} />;

export const Suggestion = ({ suggestion, onClick, className, ...props }: Omit<ComponentProps<typeof Button>, "onClick"> & { suggestion: string; onClick?: (s: string) => void }) => (
  <Button type="button" variant="outline" size="sm" className={cn("h-auto min-h-7 py-1 text-left font-normal whitespace-normal", className)} onClick={() => onClick?.(suggestion)} {...props}>
    {suggestion}
  </Button>
);
