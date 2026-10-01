"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { setBusy } from "@/lib/ui/busy";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";

type State = { status: "waiting" | "running" | "done" | "failed"; detail?: string };

// Runs the real extraction for every supplier still at "received", in parallel,
// saying in words what is being read, with a retry for any that fail.
export function ExtractPanel({ pending }: { pending: { code: string; name: string; documents: number }[] }) {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, State>>(() => Object.fromEntries(pending.map((p) => [p.code, { status: "waiting" }])));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const running = Object.values(states).some((s) => s.status === "running");
  const started = Object.values(states).some((s) => s.status !== "waiting");

  // A clock for "started 32s ago" while extraction runs.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => () => setBusy(null), []);

  async function extract(codes: string[]) {
    const t0 = Date.now();
    setStartedAt(t0);
    setNow(t0);
    setBusy({ label: "Extraction running", startedAt: t0 });
    setStates((s) => ({ ...s, ...Object.fromEntries(codes.map((c) => [c, { status: "running" as const }])) }));
    const results: State[] = [];
    await Promise.all(
      codes.map(async (code) => {
        let next: State;
        try {
          const res = await fetch(`/api/extract/${code}`, { method: "POST" });
          const body = await res.json();
          next = res.ok ? { status: "done", detail: `${body.coverage} of 30 lines, ${body.inferred} Inferred, ${body.missing} Missing` } : { status: "failed", detail: body.error ?? "The extraction did not finish." };
        } catch {
          next = { status: "failed", detail: "The request failed. Check the connection and retry." };
        }
        results.push(next);
        setStates((s) => ({ ...s, [code]: next }));
      }),
    );
    setBusy(null);
    const failed = results.filter((r) => r.status === "failed").length;
    toast(failed ? "Extraction finished with failures" : `${codes.length} quote${codes.length === 1 ? "" : "s"} read`);
    router.refresh();
  }

  const failed = Object.entries(states).filter(([, s]) => s.status === "failed").map(([c]) => c);
  const done = Object.values(states).filter((s) => s.status === "done" || s.status === "failed").length;
  const reading = pending.filter((p) => states[p.code].status === "running");
  const seconds = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;

  return (
    <section aria-label="Extract quotes" className="space-y-3 rounded-xs border border-rule bg-sheet p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-heading font-semibold">
            {pending.length} supplier response{pending.length === 1 ? "" : "s"} received, not yet read
          </h3>
          <p className="text-body text-slate">Claude reads every document and maps items to the RFx lines; code normalises the prices. It takes about a minute, and you can leave this page while it runs.</p>
        </div>
        <div className="flex gap-2">
          {!started && (
            <Button variant="primary" onClick={() => extract(pending.map((p) => p.code))}>
              Extract all quotes
            </Button>
          )}
          {failed.length > 0 && !running && <Button onClick={() => extract(failed)}>Retry failed ({failed.length})</Button>}
        </div>
      </div>
      {started && (
        <div className="space-y-3" aria-live="polite">
          <div className="space-y-1">
            <Progress tone="ink" value={(done / pending.length) * 100} aria-label={`${done} of ${pending.length} quotes read`} />
            <p className="text-meta text-slate">
              {running
                ? `Reading ${reading.map((p) => `${p.name}'s quote${p.documents > 1 ? ` (${p.documents} documents)` : ""}`).join(", ")}. ${done} of ${pending.length} done, started ${seconds}s ago.`
                : `${done} of ${pending.length} done.`}
            </p>
          </div>
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2 text-meta">
            {pending.map((p) => {
              const s = states[p.code];
              return (
                <li key={p.code} className="flex items-start gap-2 rounded-xs border border-rule px-2 py-2">
                  <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center", s.status === "done" ? "text-ledger" : s.status === "failed" ? "text-oxblood" : "text-slate")}>
                    {s.status === "done" ? <Check aria-hidden className="size-4 stroke-[1.5]" /> : s.status === "failed" ? <X aria-hidden className="size-4 stroke-[1.5]" /> : <span className={cn("size-2 rounded-full", s.status === "running" ? "animate-pulse bg-ink" : "border border-slate")} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{p.name}</span>
                    <span className={cn("block", s.status === "failed" ? "text-oxblood" : "text-slate")}>
                      {s.status === "waiting" ? "Waiting" : s.status === "running" ? "Reading..." : s.status === "done" ? "Read" : "Failed"}
                      {s.detail ? `: ${s.detail}` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
