"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Progress } from "@/lib/nav/progress";

// The real sequence, with where each step stands. /eval is deliberately not linked.
export function StepRail({ progress }: { progress: Progress | null }) {
  const path = usePathname();
  const steps = progress?.steps ?? [
    { href: "/rfx" as const, label: "RFx", state: "open" as const, note: "" },
    { href: "/quotes" as const, label: "Quotes", state: "open" as const, note: "" },
    { href: "/comparison" as const, label: "Comparison", state: "open" as const, note: "" },
    { href: "/award" as const, label: "Award", state: "open" as const, note: "" },
  ];
  return (
    <nav aria-label="Steps" className="sticky top-14 h-[calc(100vh-3.5rem)] w-[200px] shrink-0 border-r border-rule bg-sheet py-4">
      <ol>
        {steps.map((s, i) => {
          const current = path.startsWith(s.href);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={current ? "page" : undefined}
                className={`relative flex gap-3 px-5 py-2.5 hover:bg-tint ${current ? "bg-tint" : ""}`}
              >
                {current && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-ink" />}
                <StepMark n={i + 1} state={s.state} />
                <span className="min-w-0">
                  <span className={`block text-sm ${current ? "font-semibold" : ""}`}>{s.label}</span>
                  {s.note && (
                    <span className={`block text-xs ${s.state === "attention" ? (s.href === "/award" ? "text-oxblood" : "text-pencil") : "text-slate"}`}>{s.note}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepMark({ n, state }: { n: number; state: "done" | "attention" | "open" }) {
  if (state === "done") {
    return (
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ledger text-white">
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <span className="sr-only">Done:</span>
      </span>
    );
  }
  return (
    <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${state === "attention" ? "border-ink text-ink" : "border-field text-slate"}`}>
      {n}
    </span>
  );
}
