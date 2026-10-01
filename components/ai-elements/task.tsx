"use client";

// AI Elements Task, restyled: "What Lens did (3)", collapsed, each step in plain words.
import { ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";

export const Task = ({ defaultOpen = false, className, ...props }: ComponentProps<typeof Collapsible>) => <Collapsible className={cn("border-t border-rule pt-2", className)} defaultOpen={defaultOpen} {...props} />;

export const TaskTrigger = ({ title, className, ...props }: ComponentProps<typeof CollapsibleTrigger> & { title: string }) => (
  <CollapsibleTrigger className={cn("group flex items-center gap-1 text-meta font-semibold text-slate hover:text-ink", className)} {...props}>
    <ChevronRight aria-hidden className="size-3.5 stroke-[1.5] group-data-[state=open]:rotate-90" />
    {title}
  </CollapsibleTrigger>
);

export const TaskContent = ({ children, className, ...props }: ComponentProps<typeof CollapsibleContent>) => (
  <CollapsibleContent className={cn("outline-none", className)} {...props}>
    <div className="mt-2 space-y-1.5 border-l-2 border-rule pl-3">{children}</div>
  </CollapsibleContent>
);

export const TaskItem = ({ className, ...props }: ComponentProps<"div">) => <div className={cn("flex items-start gap-2 text-meta text-ink [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.5] [&_svg]:text-slate", className)} {...props} />;
