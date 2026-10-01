import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

// shadcn Button, restyled: 2px radius, ink primary, hairline secondary, no shadow.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xs font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg]:stroke-[1.5]",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white hover:bg-[#2a3d5a]",
        secondary: "border border-slate bg-sheet text-ink hover:bg-tint",
        outline: "border border-rule-strong bg-sheet text-ink hover:border-slate hover:bg-tint",
        ghost: "text-slate hover:bg-tint hover:text-ink",
        link: "px-0 text-ink underline decoration-rule underline-offset-4 hover:decoration-ink",
      },
      size: {
        default: "h-8 px-3 text-body",
        sm: "h-7 px-2 text-meta",
        icon: "size-8 text-body",
        "icon-sm": "size-7 text-meta [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "default" },
  },
);

function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
