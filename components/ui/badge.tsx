import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

// shadcn Badge, restyled: a 2px-radius chip in meta type. Colour carries state, so
// every badge also says what it means in words.
const badgeVariants = cva("inline-flex w-fit shrink-0 items-center gap-1 rounded-xs border px-1.5 text-meta whitespace-nowrap [&>svg]:size-3 [&>svg]:stroke-[1.5]", {
  variants: {
    variant: {
      neutral: "border-rule bg-sheet text-slate",
      ink: "border-ink bg-ink font-semibold text-white",
      ledger: "border-ledger/40 bg-ledger-tint text-ledger",
      oxblood: "border-oxblood/40 bg-oxblood-tint text-oxblood",
      pencil: "border-amber/50 bg-amber-tint text-pencil",
    },
  },
  defaultVariants: { variant: "neutral" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
