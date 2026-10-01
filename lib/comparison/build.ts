// The Quote Comparison: 30 lines by 5 suppliers in INR per piece, ex-GST, delivered.
// Pure and deterministic; every total, L1 and spread on screen comes from here.
//
// A cell counts toward L1, spread and totals when it has a value and, if it is a
// substitute, Arjun has approved it. Missing is never imputed. In "all lines" mode a
// gap is priced at the lowest other countable quote and labelled as such.

export type ComparisonCellInput = {
  value: number | null;
  confidence: "extracted" | "inferred" | "missing";
  isSubstitute: boolean;
  substituteStatus: "pending" | "approved" | "rejected" | null;
};

export type LineInput = { lineNo: number; quantity: number; lastCycle: number | null };

export type ComparisonInput = {
  suppliers: string[];
  lines: LineInput[];
  cells: Record<string, Record<number, ComparisonCellInput | undefined>>;
};

export type BasketMode = "common" | "all";

export type LineResult = {
  lineNo: number;
  countable: Record<string, boolean>;
  l1: string[];
  l1Value: number | null;
  l2Value: number | null;
  spreadPct: number | null;
  inCommonBasket: boolean;
  gapFill: Record<string, number | null>;
};

export type SupplierResult = {
  code: string;
  quoted: number;
  countable: number;
  commonBasketTotal: number;
  allLinesTotal: number;
  gapFilledLines: number[];
};

export type ComparisonResult = {
  lines: LineResult[];
  suppliers: SupplierResult[];
  commonBasket: number[];
  pricedLines: number[];
  lastCycleCommonBasket: number;
  lastCycleAllLines: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function counts(cell: ComparisonCellInput | undefined): cell is ComparisonCellInput & { value: number } {
  if (!cell || cell.value === null || cell.confidence === "missing") return false;
  return !cell.isSubstitute || cell.substituteStatus === "approved";
}

export function buildComparison({ suppliers, lines, cells }: ComparisonInput): ComparisonResult {
  const lineResults: LineResult[] = lines.map(({ lineNo }) => {
    const countable = Object.fromEntries(suppliers.map((s) => [s, counts(cells[s]?.[lineNo])]));
    const offers = suppliers.filter((s) => countable[s]).map((s) => ({ s, v: cells[s]![lineNo]!.value! })).sort((a, b) => a.v - b.v);
    const l1Value = offers[0]?.v ?? null;
    const l2 = offers.find((o) => o.v > (l1Value ?? Infinity));
    const max = offers.at(-1)?.v ?? null;
    const gapFill = Object.fromEntries(
      suppliers.map((s) => {
        if (countable[s]) return [s, null];
        const others = offers.filter((o) => o.s !== s);
        return [s, others.length ? others[0].v : null];
      }),
    );
    return {
      lineNo,
      countable,
      l1: offers.filter((o) => o.v === l1Value).map((o) => o.s),
      l1Value,
      l2Value: l2?.v ?? null,
      spreadPct: l1Value && max !== null && offers.length > 1 ? round2(((max - l1Value) / l1Value) * 100) : null,
      inCommonBasket: suppliers.every((s) => countable[s]),
      gapFill,
    };
  });

  const qty = new Map(lines.map((l) => [l.lineNo, l.quantity]));
  const commonBasket = lineResults.filter((l) => l.inCommonBasket).map((l) => l.lineNo);
  const pricedLines = lineResults.filter((l) => l.l1Value !== null).map((l) => l.lineNo);

  const supplierResults: SupplierResult[] = suppliers.map((s) => {
    let common = 0;
    let all = 0;
    const gapFilled: number[] = [];
    for (const l of lineResults) {
      const q = qty.get(l.lineNo)!;
      if (l.countable[s]) {
        const v = cells[s]![l.lineNo]!.value! * q;
        all += v;
        if (l.inCommonBasket) common += v;
      } else if (l.gapFill[s] !== null) {
        all += l.gapFill[s]! * q;
        gapFilled.push(l.lineNo);
      }
    }
    return {
      code: s,
      quoted: lines.filter((l) => {
        const c = cells[s]?.[l.lineNo];
        return !!c && c.confidence !== "missing";
      }).length,
      countable: lineResults.filter((l) => l.countable[s]).length,
      commonBasketTotal: round2(common),
      allLinesTotal: round2(all),
      gapFilledLines: gapFilled,
    };
  });

  const lastCycle = (lineNos: number[]) =>
    round2(lineNos.reduce((sum, n) => sum + (lines.find((l) => l.lineNo === n)?.lastCycle ?? 0) * qty.get(n)!, 0));

  return {
    lines: lineResults,
    suppliers: supplierResults,
    commonBasket,
    pricedLines,
    lastCycleCommonBasket: lastCycle(commonBasket),
    lastCycleAllLines: lastCycle(pricedLines),
  };
}

export function totalFor(s: SupplierResult, mode: BasketMode): number {
  return mode === "common" ? s.commonBasketTotal : s.allLinesTotal;
}

export function cheapest(result: ComparisonResult, mode: BasketMode): string | null {
  if (mode === "common" && !result.commonBasket.length) return null;
  const sorted = [...result.suppliers].sort((a, b) => totalFor(a, mode) - totalFor(b, mode));
  return sorted[0]?.code ?? null;
}
