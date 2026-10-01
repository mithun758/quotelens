"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { stageHref, type Progress, type Stage, type StageState } from "@/lib/nav/progress";
import { useLens } from "./lens/LensProvider";

// Which section of a long screen is in view: the last one whose top has passed 35%
// of the viewport. Drives the current stage on Quotes and Award.
function useSectionInView(ids: string[]): string | null {
  const [current, setCurrent] = useState<string | null>(null);
  const key = ids.join();
  useEffect(() => {
    if (!key) return;
    const list = key.split(",");
    const update = () => {
      let found: string | null = null;
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) found = id;
      }
      setCurrent(found ?? list[0]);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("hashchange", update);
    };
  }, [key]);
  return current;
}

// The real sequence: four steps with the journey's stages nested under each.
// /eval is deliberately not linked.
export function StepRail({ progress }: { progress: Progress | null }) {
  const path = usePathname();
  const params = useSearchParams();
  const compact = useLens().open;
  const sections = (progress?.steps ?? []).find((s) => path.startsWith(s.href))?.stages.flatMap((st) => (st.target.section ? [st.target.section] : [])) ?? [];
  const inView = useSectionInView(sections);
  const view = params.get("view") ?? "prices";
  const analyst = params.get("analyst") === "1";

  const isCurrent = (st: Stage) => {
    const t = st.target;
    if (!path.startsWith(t.path)) return false;
    if (t.section) return inView === t.section;
    if (t.path === "/comparison") return t.analyst ? analyst : !analyst && view === t.view;
    return true;
  };

  if (!progress) {
    return <nav aria-label="Steps" className={`sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 border-r border-rule bg-sheet ${compact ? "w-16" : "w-[220px]"}`} />;
  }

  // With Lens open, the rail compacts to a strip of numbered steps; the stages show on hover.
  if (compact) {
    return (
      <nav aria-label="Steps" className="sticky top-14 h-[calc(100vh-3.5rem)] w-16 shrink-0 border-r border-rule bg-sheet py-3">
        <ol className="flex flex-col items-center gap-1">
          {progress.steps.map((step, i) => {
            const onStep = path.startsWith(step.href);
            const state: StageState = step.stages.every((st) => st.state === "done") ? "done" : step.stages.some((st) => st.state === "attention") ? "attention" : "open";
            const count = step.stages.reduce((n, st) => n + (st.state === "attention" && st.count ? st.count : 0), 0);
            const summary = `${i + 1}. ${step.label}: ${step.stages.map((st) => `${st.label}, ${st.note}`).join("; ")}`;
            return (
              <li key={step.href} className="w-full">
                <Link
                  href={step.href}
                  aria-current={onStep ? "page" : undefined}
                  aria-label={summary}
                  title={summary}
                  className={`relative flex flex-col items-center gap-1 py-2 hover:bg-tint ${onStep ? "bg-tint" : ""}`}
                >
                  {onStep && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-ink" />}
                  <StepMark n={i + 1} state={state} />
                  <span className={`text-[11px] leading-3 ${onStep ? "font-semibold" : "text-slate"}`}>{step.label === "Comparison" ? "Compare" : step.label}</span>
                  {count > 0 && <span className={`rounded-xs px-1 text-[11px] font-semibold leading-4 ${step.href === "/award" ? "bg-oxblood-tint text-oxblood" : "bg-amber-tint text-pencil"}`}>{count}</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Steps" className="sticky top-14 h-[calc(100vh-3.5rem)] w-[220px] shrink-0 overflow-y-auto border-r border-rule bg-sheet py-3">
      <ol>
        {progress.steps.map((step, i) => {
          const onStep = path.startsWith(step.href);
          const state: StageState = step.stages.every((s) => s.state === "done") ? "done" : step.stages.some((s) => s.state === "attention") ? "attention" : "open";
          return (
            <li key={step.href} className="pb-2">
              <Link href={step.href} aria-current={onStep ? "page" : undefined} className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-tint">
                <StepMark n={i + 1} state={state} />
                <span className={`text-sm ${onStep ? "font-semibold" : ""}`}>{step.label}</span>
              </Link>
              <ol className="ml-[1.6rem] border-l border-rule">
                {step.stages.map((st) => {
                  const current = isCurrent(st);
                  return (
                    <li key={st.key}>
                      <Link
                        href={stageHref(st.target)}
                        aria-current={current ? "step" : undefined}
                        className={`relative -ml-px flex items-start gap-2 border-l-[3px] py-1 pl-2.5 pr-3 hover:bg-tint ${current ? "border-ink bg-tint" : "border-transparent"}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[13px] leading-[18px] ${current ? "font-semibold" : ""}`}>{st.label}</span>
                          <span className={`block text-xs ${st.state === "attention" ? (st.key === "readiness" ? "text-oxblood" : "text-pencil") : "text-slate"}`}>{st.note}</span>
                        </span>
                        <StageMark stage={st} />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StageMark({ stage }: { stage: Stage }) {
  if (stage.state === "done") {
    return (
      <span className="mt-0.5 text-ledger">
        <svg viewBox="0 0 12 12" className="size-3.5" aria-hidden>
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <span className="sr-only">Done</span>
      </span>
    );
  }
  if (stage.state === "attention" && stage.count !== null) {
    return (
      <span className={`mt-0.5 min-w-5 rounded-xs px-1 text-center text-xs font-semibold leading-[18px] ${stage.key === "readiness" ? "bg-oxblood-tint text-oxblood" : "bg-amber-tint text-pencil"}`}>
        {stage.count}
        <span className="sr-only"> need attention</span>
      </span>
    );
  }
  return null;
}

function StepMark({ n, state }: { n: number; state: StageState }) {
  if (state === "done") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ledger text-white">
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <span className="sr-only">Done:</span>
      </span>
    );
  }
  return <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${state === "attention" ? "border-ink text-ink" : "border-field text-slate"}`}>{n}</span>;
}
