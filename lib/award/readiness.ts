// How many RFx lines the chosen scenario could award right now: allocated, with no open
// blocker on that line or on its supplier as a whole. Derived from scenarioBlockers.
import type { BlockerView } from "./view";

type OpenCheck = Pick<BlockerView, "supplier" | "line" | "override">;

export function linesReady(allocation: { line: number; supplier: string }[], blockers: OpenCheck[]): number {
  const open = blockers.filter((b) => !b.override);
  return allocation.filter((a) => !open.some((b) => b.supplier === a.supplier && (b.line === null || b.line === a.line))).length;
}

export function readinessFor(allocation: { line: number; supplier: string }[], blockers: OpenCheck[], totalLines: number): { ready: number; total: number } {
  return { ready: linesReady(allocation, blockers), total: totalLines };
}
