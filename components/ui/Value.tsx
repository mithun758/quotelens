"use client";

import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import type { ConfidenceState } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

// A price or term, with its confidence in the type itself. Extracted is plain ink;
// Inferred is pencil with a dotted amber underline and its reason on hover or focus;
// Missing is an empty hatched space, never a zero or a dash. A revised price shows the
// earlier price struck through beneath it.
export type Revision = { was: ReactNode; date?: string | null; why?: string | null };

export function Value({
  state,
  reason,
  children,
  revised,
  plain = false,
  className = "",
}: {
  state: ConfidenceState | null | undefined;
  reason?: string | null;
  children?: ReactNode;
  revised?: Revision | null;
  // Inside a control that already explains the value (a matrix cell button): styles
  // only, no tooltip and no extra tab stop.
  plain?: boolean;
  className?: string;
}) {
  // A price revised while on screen (after a reconfirmation) shows the change: the old
  // price fades to a strike-through and the new one fades in. Never on page load.
  const [mountedUnrevised] = useState(!revised);
  const animate = mountedUnrevised && !!revised;
  const fade = animate ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3 } } : {};
  if (plain) {
    if (state === "missing") return <span aria-hidden className={cn("val-missing inline-block h-[18px] w-full min-w-10 align-middle", className)} />;
    const value = <span className={cn(state === "inferred" && "val-inferred", !revised && className)}>{children}</span>;
    if (!revised) return value;
    return (
      <span className={cn("inline-flex flex-col items-end leading-4", className)}>
        <motion.span {...fade}>{value}</motion.span>
        <motion.s {...fade} className="revised-was text-meta leading-4 font-normal text-slate decoration-slate">
          {revised.was}
        </motion.s>
      </span>
    );
  }
  if (state === "missing") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span role="img" aria-label={`Not quoted${reason ? `: ${reason}` : ""}`} className={cn("val-missing inline-block h-[18px] w-full min-w-10 align-middle", className)} />
        </TooltipTrigger>
        <TooltipContent>{reason ?? "Not quoted"}</TooltipContent>
      </Tooltip>
    );
  }
  const main =
    state === "inferred" ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={cn("val-inferred", !revised && className)}>
            {children}
            <span className="sr-only">, Inferred{reason ? `: ${reason}` : ""}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="font-semibold text-pencil">Inferred.</span> {reason ?? "A judgement or code-derived conversion; check before relying on it."}
        </TooltipContent>
      </Tooltip>
    ) : (
      <span className={cn(!revised && className)}>{children}</span>
    );
  if (!revised) return main;
  const note = `Revised${revised.date ? ` on ${revised.date}` : ""}, was ${typeof revised.was === "string" ? revised.was : ""}`.replace(/, was $/, "");
  return (
    <span className={cn("inline-flex flex-col items-end leading-4", className)}>
      {main}
      <Tooltip>
        <TooltipTrigger asChild>
          <s tabIndex={0} className="revised-was text-meta leading-4 font-normal text-slate decoration-slate">
            {revised.was}
            <span className="sr-only"> (earlier price)</span>
          </s>
        </TooltipTrigger>
        <TooltipContent>
          {note}.{revised.why ? <span className="block text-slate">{revised.why}</span> : null}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
