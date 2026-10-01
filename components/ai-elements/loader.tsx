import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// AI Elements Loader, restyled: a small slate spinner; it stops under reduced motion.
export const Loader = ({ className, size = 14, ...props }: HTMLAttributes<HTMLSpanElement> & { size?: number }) => (
  <span aria-hidden className={cn("inline-flex animate-spin items-center justify-center text-slate motion-reduce:animate-none", className)} {...props}>
    <svg height={size} width={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </span>
);
