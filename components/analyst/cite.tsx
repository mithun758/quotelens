"use client";

import { Children, createContext, isValidElement, useContext, type ReactNode } from "react";

// Lets an analyst answer point at the comparison. A unit price becomes a button that
// scrolls to its cell only when it matches exactly one cell on a line that the same
// sentence or table row mentions, so a price change or total is never mis-cited.
export type Citer = { keyFor: (value: number, lines: number[]) => string | null; cite: (key: string) => void };
export const CiteContext = createContext<Citer | null>(null);
const LineScope = createContext<number[]>([]);

// Unit prices as written: "₹62,604", "62,604" or "₹4,356.9". Totals in lakh or crore and
// percentages are skipped.
const PRICE = /₹?\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|₹\d{3,}(?:\.\d+)?/g;
const LINE_REF = /\blines?\s+((?:\d{1,2}(?:\s*(?:,|and|to|-)\s*)?)+)/gi;

export function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

// Line numbers a passage refers to: "line 4", "lines 1, 3 and 5", or a table row whose
// first cell is a line number.
export function linesIn(text: string, firstCell?: string): number[] {
  const out = new Set<number>();
  for (const m of text.matchAll(LINE_REF)) for (const n of m[1].match(/\d+/g) ?? []) out.add(Number(n));
  if (firstCell && /^\s*\d{1,2}\s*$/.test(firstCell)) out.add(Number(firstCell));
  return [...out];
}

export function LineScopeFor({ text, firstCell, children }: { text: string; firstCell?: string; children: ReactNode }) {
  const outer = useContext(LineScope);
  const own = linesIn(text, firstCell);
  return <LineScope.Provider value={own.length ? own : outer}>{children}</LineScope.Provider>;
}

function linkify(text: string, citer: Citer, lines: number[]): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(PRICE)) {
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 7);
    if (/^\s?(lakh|crore|cr\b|%)/i.test(after)) continue;
    const key = citer.keyFor(Number(m[0].replace(/[₹,]/g, "")), lines);
    if (!key) continue;
    out.push(text.slice(last, m.index));
    out.push(
      <button key={`${m.index}-${key}`} type="button" onClick={() => citer.cite(key)} title="Show this cell in the comparison" className="underline decoration-dotted decoration-slate underline-offset-[3px] hover:decoration-ink">
        {m[0]}
      </button>,
    );
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

export function Cited({ children }: { children: ReactNode }) {
  const citer = useContext(CiteContext);
  const lines = useContext(LineScope);
  if (!citer || !lines.length) return <>{children}</>;
  return <>{Children.map(children, (child) => (typeof child === "string" ? linkify(child, citer, lines) : child))}</>;
}

export function firstCellText(children: ReactNode): string {
  const first = Children.toArray(children).find((c) => isValidElement(c));
  return first ? textOf(first) : "";
}
