"use client";

import { ArrowRight, Hash, MessageSquare, Search, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { stageHref, type Progress } from "@/lib/nav/progress";
import { useLens } from "./lens/LensProvider";
import { Button } from "./ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "./ui/command";

// Cmd+K: ask Lens, go to a screen or stage, open a supplier, or find a line. Cmd+J
// opens and closes the Lens dock.
export function CommandBar({ search, steps }: { search: Progress["search"]; steps: Progress["steps"] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const lens = useLens();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key.toLowerCase() === "j") {
        e.preventDefault();
        lens.setOpen(!lens.open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lens]);

  const run = (fn: () => void) => {
    setOpen(false);
    setQuery("");
    fn();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-48 justify-start font-normal text-slate">
        <Search aria-hidden />
        Search or ask Lens
        <kbd className="ml-auto rounded-xs border border-rule px-1 font-sans text-meta text-slate">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search or ask Lens" description="Ask Lens, go to a screen, open a supplier or find a line.">
        <Command>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Ask Lens, or search screens, suppliers and lines" />
          <CommandList>
            <CommandEmpty>Nothing matches. Press Enter on Ask Lens to ask instead.</CommandEmpty>
            {query.trim() && (
              <CommandGroup heading="Ask Lens" forceMount>
                <CommandItem
                  forceMount
                  value={`ask ${query}`}
                  onSelect={() =>
                    run(() => {
                      lens.setOpen(true);
                      lens.ask(query);
                    })
                  }
                >
                  <MessageSquare aria-hidden />
                  <span className="truncate">Ask Lens: {query}</span>
                  <CommandShortcut>Enter</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Go to">
              {steps.flatMap((step) =>
                step.stages.map((st) => (
                  <CommandItem key={st.key} value={`go ${step.label} ${st.label}`} onSelect={() => run(() => router.push(stageHref(st.target)))}>
                    <ArrowRight aria-hidden />
                    <span>
                      {step.label}
                      <span className="text-slate">, {st.label}</span>
                    </span>
                    <CommandShortcut>{st.note}</CommandShortcut>
                  </CommandItem>
                )),
              )}
              <CommandItem value="go evaluation extraction accuracy" onSelect={() => run(() => router.push("/eval"))}>
                <ArrowRight aria-hidden />
                Evaluation
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Suppliers">
              {search.suppliers.map((s) => (
                <CommandItem key={s.code} value={`supplier ${s.code} ${s.name}`} onSelect={() => run(() => router.push(`/quotes?supplier=${s.code}`))}>
                  <Store aria-hidden />
                  <span>
                    <span className="text-slate">{s.code}</span> {s.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Lines">
              {search.lines.map((l) => (
                <CommandItem key={l.line_no} value={`line ${l.line_no} ${l.description}`} onSelect={() => run(() => router.push(`/comparison?line=${l.line_no}`))}>
                  <Hash aria-hidden />
                  <span className="truncate">
                    <span className="text-slate">{l.line_no}</span> {l.description}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
