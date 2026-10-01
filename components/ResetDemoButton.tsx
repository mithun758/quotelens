"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resetDemo } from "@/app/actions/resetDemo";
import { useBusy } from "@/lib/ui/busy";
import { LENS_KEYS } from "./lens/LensProvider";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

export function ResetDemoButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // Locked while extraction runs in this tab, saying why.
  const busy = useBusy();

  function reset() {
    setError(null);
    startTransition(async () => {
      const result = await resetDemo();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Reset also clears the Lens conversation and its briefing memory.
      try {
        sessionStorage.removeItem(LENS_KEYS.conversation);
        sessionStorage.removeItem(LENS_KEYS.briefed);
      } catch {
        // Storage may be unavailable; nothing to clear then.
      }
      window.dispatchEvent(new Event("quotelens:reset"));
      setOpen(false);
      toast("Demo reset");
      router.push("/quotes");
    });
  }

  if (busy) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="rounded-xs">
            <Button variant="ghost" size="sm" disabled>
              <RotateCcw aria-hidden />
              Reset demo
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <BusyNote startedAt={busy.startedAt} label={busy.label} />
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <RotateCcw aria-hidden />
          Reset demo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset the demo?</DialogTitle>
          <DialogDescription>
            Supplier quotes go back to received; extract them again on Quotes, which takes about a minute. All decisions, clarifications, the award and the RFx draft are cleared.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="rounded-xs border-l-2 border-oxblood bg-oxblood-tint px-3 py-2 text-body text-oxblood">
            Reset did not finish: {error}. Try again.
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="primary" onClick={reset} disabled={pending}>
            {pending ? "Resetting..." : "Reset demo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// "Extraction running, started 32s ago", counted when the tooltip opens.
function BusyNote({ label, startedAt }: { label: string; startedAt: number }) {
  const [now] = useState(() => Date.now());
  return (
    <>
      {label}, started {Math.max(0, Math.round((now - startedAt) / 1000))}s ago.
    </>
  );
}
