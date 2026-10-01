"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { stageHref, type Progress, type Stage, type StageState } from "@/lib/nav/progress";
import { useHydrated } from "@/lib/ui/useHydrated";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
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
// Evaluation sits at the foot of the rail.
export function StepRail({ progress }: { progress: Progress | null }) {
  const path = usePathname();
  const params = useSearchParams();
  const lensOpen = useLens().open;
  // The rail hydrates inside Suspense, after Lens has restored its saved state; until
  // then it matches the server render (Lens open, rail compact).
  const compact = useHydrated() ? lensOpen : true;
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

  const stepState = (step: Progress["steps"][number]): StageState =>
    step.stages.every((st) => st.state === "done") ? "done" : step.stages.some((st) => st.state === "attention") ? "attention" : "open";
  const stepCount = (step: Progress["steps"][number]) => step.stages.reduce((n, st) => n + (st.state === "attention" && st.count ? st.count : 0), 0);

  // With Lens open, the rail compacts to numbered squares; the name and count show on hover.
  if (compact) {
    return (
      <nav aria-label="Steps" className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-16 shrink-0 flex-col border-r border-rule bg-sheet py-3">
        <ol className="flex flex-col items-center gap-1">
          {progress.steps.map((step, i) => {
            const onStep = path.startsWith(step.href);
            const count = stepCount(step);
            return (
              <li key={step.href} className="w-full">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={step.href} aria-current={onStep ? "page" : undefined} className={cn("relative flex flex-col items-center gap-1 py-2 hover:bg-tint", onStep && "bg-tint")}>
                      {onStep && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-ink" />}
                      <StepSquare n={i + 1} state={stepState(step)} current={onStep} />
                      <span className="sr-only">{step.label}</span>
                      {count > 0 && <CountChip count={count} tone={step.href === "/award" ? "oxblood" : "pencil"} />}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <span className="font-semibold">{step.label}</span>
                    {step.stages.map((st) => (
                      <span key={st.key} className="block text-slate">
                        {st.label}: {st.note}
                      </span>
                    ))}
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ol>
        <Link href="/eval" aria-current={path.startsWith("/eval") ? "page" : undefined} className={cn("mt-auto py-2 text-center text-meta text-slate hover:bg-tint hover:text-ink", path.startsWith("/eval") && "font-semibold text-ink")}>
          Eval
        </Link>
      </nav>
    );
  }

  return (
    <nav aria-label="Steps" className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-[220px] shrink-0 flex-col overflow-y-auto border-r border-rule bg-sheet py-4">
      <ol className="space-y-4">
        {progress.steps.map((step, i) => {
          const onStep = path.startsWith(step.href);
          const state = stepState(step);
          const count = stepCount(step);
          return (
            <li key={step.href}>
              <Link href={step.href} aria-current={onStep ? "page" : undefined} className="flex h-8 items-center gap-2 px-4 hover:bg-tint">
                <StepIcon state={state} current={onStep} />
                <span className={cn("flex-1 text-body", onStep && "font-semibold")}>
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.label}
                </span>
                {count > 0 && <CountChip count={count} tone={step.href === "/award" ? "oxblood" : "pencil"} />}
              </Link>
              <ol className="mt-1">
                {step.stages.map((st) => {
                  const current = isCurrent(st);
                  return (
                    <li key={st.key}>
                      <Link
                        href={stageHref(st.target)}
                        aria-current={current ? "step" : undefined}
                        className={cn("relative flex items-start gap-2 py-1 pr-4 pl-10 hover:bg-tint", current && "bg-tint")}
                      >
                        {current && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-ink" />}
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-table", current && "font-semibold")}>{st.label}</span>
                          <span className={cn("block text-meta", st.state === "attention" ? (st.key === "readiness" ? "text-oxblood" : "text-pencil") : "text-slate")}>{st.note}</span>
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
      <Link href="/eval" aria-current={path.startsWith("/eval") ? "page" : undefined} className={cn("mt-auto flex h-8 items-center px-4 text-meta text-slate hover:bg-tint hover:text-ink", path.startsWith("/eval") && "font-semibold text-ink")}>
        Evaluation
      </Link>
    </nav>
  );
}

function CountChip({ count, tone }: { count: number; tone: "oxblood" | "pencil" }) {
  return (
    <Badge variant={tone} className="min-w-5 justify-center px-1 font-semibold">
      {count}
      <span className="sr-only"> need attention</span>
    </Badge>
  );
}

function StageMark({ stage }: { stage: Stage }) {
  if (stage.state === "done") {
    return (
      <span className="mt-0.5 text-ledger">
        <Check aria-hidden className="size-3.5 stroke-[1.5]" />
        <span className="sr-only">Done</span>
      </span>
    );
  }
  if (stage.state === "attention" && stage.count !== null) return <CountChip count={stage.count} tone={stage.key === "readiness" ? "oxblood" : "pencil"} />;
  return null;
}

// Expanded rail: a ledger check for done, a filled ink dot for the current step, a
// hollow circle for what is still to come.
function StepIcon({ state, current }: { state: StageState; current: boolean }) {
  if (state === "done") {
    return (
      <span className="flex size-4 items-center justify-center text-ledger">
        <Check aria-hidden className="size-4 stroke-[1.5]" />
        <span className="sr-only">Done:</span>
      </span>
    );
  }
  return (
    <span className="flex size-4 items-center justify-center">
      <span aria-hidden className={cn("size-2.5 rounded-full border-[1.5px]", current ? "border-ink bg-ink" : "border-slate")} />
    </span>
  );
}

// Compact rail: a numbered square in the step's state colour.
function StepSquare({ n, state, current }: { n: number; state: StageState; current: boolean }) {
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-xs border text-meta font-semibold",
        state === "done" ? "border-ledger bg-ledger text-white" : current ? "border-ink bg-ink text-white" : "border-slate text-slate",
      )}
    >
      {state === "done" ? <Check aria-hidden className="size-3.5 stroke-2" /> : n}
      {state === "done" && <span className="sr-only">Done</span>}
    </span>
  );
}
