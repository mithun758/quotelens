import { cn } from "@/lib/utils";

// shadcn Skeleton: a quiet block shaped like the content it stands in for.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("animate-pulse rounded-xs bg-tint", className)} {...props} />;
}

export { Skeleton };
