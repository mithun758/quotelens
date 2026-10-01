"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { stageHref, type Progress, type Stage, type StageState } from "@/lib/nav/progress";

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
    return <nav aria-label="Steps" className="sticky top-14 h-[calc(100vh-3.5rem)] w-[220px] shrink-0 border-r border-rule bg-sheet" />;
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
