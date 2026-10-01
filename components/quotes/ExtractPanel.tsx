"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn } from "../ui/styles";

type State = { status: "waiting" | "running" | "done" | "failed"; detail?: string };

// Runs the real extraction for every supplier still at "received", in parallel,
// showing progress per supplier with a retry for any that fail.
export function ExtractPanel({ pending }: { pending: { code: string; name: string }[] }) {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, State>>(() => Object.fromEntries(pending.map((p) => [p.code, { status: "waiting" }])));
  const [running, setRunning] = useState(false);
  const started = Object.values(states).some((s) => s.status !== "waiting");

  async function extract(codes: string[]) {
    setRunning(true);
    setStates((s) => ({ ...s, ...Object.fromEntries(codes.map((c) => [c, { status: "running" as const }])) }));
    await Promise.all(
      codes.map(async (code) => {
        let next: State;
        try {
          const res = await fetch(`/api/extract/${code}`, { method: "POST" });
          const body = await res.json();
          next = res.ok ? { status: "done", detail: `${body.coverage}/30 lines, ${body.inferred} Inferred, ${body.missing} Missing` } : { status: "failed", detail: body.error ?? `HTTP ${res.status}` };
        } catch {
          next = { status: "failed", detail: "The request failed. Check the connection and retry." };
        }
        setStates((s) => ({ ...s, [code]: next }));
      }),
    );
    setRunning(false);
    router.refresh();
  }

  const failed = Object.entries(states).filter(([, s]) => s.status === "failed").map(([c]) => c);
  const label = { waiting: "Waiting", running: "Reading...", done: "Done", failed: "Failed" } as const;
  const tone = { waiting: "text-slate", running: "text-ink", done: "text-ledger", failed: "text-oxblood" } as const;

  return (
    <section aria-label="Extract quotes" className="border-l-[3px] border-ink bg-sheet px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            {pending.length} supplier response{pending.length === 1 ? "" : "s"} received, not yet read
          </h2>
          <p className="text-sm text-slate">Claude reads every document and maps items to the RFx lines; code normalises the prices. It takes about a minute, and you can leave this page while it runs.</p>
        </div>
        <div className="flex gap-2">
          {!started && (
            <button type="button" disabled={running} onClick={() => extract(pending.map((p) => p.code))} className={btn.primary}>
              Extract all quotes
            </button>
          )}
          {failed.length > 0 && !running && (
            <button type="button" onClick={() => extract(failed)} className={btn.secondary}>
              Retry failed ({failed.length})
            </button>
          )}
        </div>
      </div>
      {started && (
        <ol className="mt-3 grid border-t border-rule text-xs" style={{ gridTemplateColumns: `repeat(${pending.length}, minmax(0, 1fr))` }} aria-live="polite">
          {pending.map((p) => (
            <li key={p.code} className="border-r border-rule px-2 py-2 last:border-r-0">
              <span className="block font-semibold">
                {p.code}. {p.name}
              </span>
              <span className={`block ${tone[states[p.code].status]}`}>
                {label[states[p.code].status]}
                {states[p.code].detail ? `: ${states[p.code].detail}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
