"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const label = { waiting: "Waiting", running: "Extracting...", done: "Done", failed: "Failed" } as const;
  const tone = { waiting: "text-zinc-500", running: "text-sky-800", done: "text-emerald-700", failed: "text-red-700" } as const;

  return (
    <section className="rounded-md border border-sky-200 bg-sky-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-sky-950">
            {pending.length} supplier response{pending.length === 1 ? "" : "s"} received, not yet extracted
          </h2>
          <p className="text-xs text-sky-900">Claude reads every document, maps items to the 30 RFx lines and code normalises the prices. About a minute.</p>
        </div>
        <div className="flex gap-2">
          {!started && (
            <button type="button" disabled={running} onClick={() => extract(pending.map((p) => p.code))} className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-800 disabled:opacity-50">
              Extract all quotes
            </button>
          )}
          {failed.length > 0 && !running && (
            <button type="button" onClick={() => extract(failed)} className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-800 hover:bg-red-50">
              Retry failed ({failed.length})
            </button>
          )}
        </div>
      </div>
      {started && (
        <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-5">
          {pending.map((p) => (
            <li key={p.code} className="rounded border border-sky-200 bg-white px-2 py-1">
              <span className="font-medium">
                {p.code}. {p.name}
              </span>
              <span className={`block ${tone[states[p.code].status]}`}>
                {label[states[p.code].status]}
                {states[p.code].detail ? `: ${states[p.code].detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
