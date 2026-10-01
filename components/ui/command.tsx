"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

// shadcn Command (cmdk), restyled for the Cmd+K bar.
function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cn("flex h-full w-full flex-col overflow-hidden bg-sheet text-ink", className)} {...props} />;
}

function CommandDialog({ title, description, children, ...props }: React.ComponentProps<typeof Dialog> & { title: string; description: string }) {
  return (
    <Dialog {...props}>
      <DialogContent showCloseButton={false} className="top-[20%] translate-y-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-rule px-4">
      <Search aria-hidden className="size-4 shrink-0 stroke-[1.5] text-slate" />
      <CommandPrimitive.Input data-slot="command-input" className={cn("h-12 w-full bg-transparent text-body outline-none placeholder:text-slate focus-visible:outline-none", className)} {...props} />
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List data-slot="command-list" className={cn("max-h-[360px] scroll-py-2 overflow-x-hidden overflow-y-auto p-2", className)} {...props} />;
}

function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className="py-6 text-center text-body text-slate" {...props} />;
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn("pb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-meta [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate", className)}
      {...props}
    />
  );
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "flex cursor-default items-center gap-2 rounded-xs px-2 py-1.5 text-body select-none data-[selected=true]:bg-tint [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.5] [&_svg]:text-slate",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("ml-auto text-meta text-slate", className)} {...props} />;
}

export { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut };
