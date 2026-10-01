import { describe, expect, it } from "vitest";
import groundTruth from "@/seed/ground_truth.json";
import { LINE_ITEMS, MEMORY_INDEX, USD_INR } from "@/seed/data";
import { evaluateFreshness, type FreshnessInput } from "@/lib/freshness/rules";

const MEMORY_LINES = new Set(LINE_ITEMS.filter((l) => l.memory_exposed).map((l) => l.line_no));
const memoryIndex = MEMORY_INDEX.points.map(([date, value]) => ({ date, value }));
const fxRates = { USD: USD_INR.points.map(([date, value]) => ({ date, value })) };

type Code = keyof typeof groundTruth.suppliers;

// The inputs the app assembles after extraction, built from the seeded documents' truth.
function inputFor(code: Code): FreshnessInput {
  const s = groundTruth.suppliers[code];
  const quoted = s.lines.filter((l) => l.expected_normalised_inr !== null);
  return {
    asOfDate: "2026-09-30",
    approvalDays: 10,
    quoteDate: s.terms.quote_date,
    validUntil: s.terms.valid_until,
    referencesPriorPricing: quoted.some((l) => l.raw_value === "same as last year's rates"),
    priorPricingLines: quoted.filter((l) => l.raw_value === "same as last year's rates").map((l) => l.line_no),
    foreignCurrencies: [...new Set(quoted.map((l) => l.raw_currency).filter((c): c is string => !!c && c !== "INR"))],
    fxRates,
    memoryExposedLines: quoted.filter((l) => MEMORY_LINES.has(l.line_no)).map((l) => l.line_no),
    memoryIndex,
  };
}

const fired = (code: Code) => evaluateFreshness(inputFor(code)).fired.map((r) => [r.key, r.severity]);

describe("Quote Freshness on the seeded suppliers", () => {
  it("B is Stale: valid until 1 Oct, before approval completes on 10 Oct", () => {
    const r = evaluateFreshness(inputFor("B"));
    expect(r.status).toBe("Stale");
    expect(fired("B")).toEqual([["validity_vs_approval", "high"]]);
    expect(r.fired[0].reason).toContain("Valid until 1 Oct 2026, but approval completes 10 Oct 2026");
  });

  it("D is Stale: rate card 118 days old and memory index up 11.2% on its memory lines", () => {
    const r = evaluateFreshness(inputFor("D"));
    expect(r.status).toBe("Stale");
    expect(fired("D")).toEqual([
      ["validity_missing", "medium"],
      ["old_price_basis", "high"],
      ["market_movement", "high"],
    ]);
    expect(r.fired.find((x) => x.key === "old_price_basis")!.reason).toContain("118 days");
    const market = r.fired.find((x) => x.key === "market_movement")!;
    expect(market.reason).toContain("+11.2%");
    expect(market.lines).toEqual([1, 5, 6, 28]);
  });

  it("E is Reconfirm: prior pricing and USD/INR up 1.8% since 14 Sep, both Medium", () => {
    const r = evaluateFreshness(inputFor("E"));
    expect(r.status).toBe("Reconfirm");
    expect(fired("E")).toEqual([
      ["prior_pricing", "medium"],
      ["fx_movement", "medium"],
    ]);
    expect(r.fired.find((x) => x.key === "fx_movement")!.reason).toContain("+1.8%");
    expect(r.rules.find((x) => x.key === "market_movement")!.fired).toBe(false); // memory index +1.5% since 14 Sep
  });

  it("A and C are Fresh", () => {
    expect(evaluateFreshness(inputFor("A")).status).toBe("Fresh");
    expect(evaluateFreshness(inputFor("C")).status).toBe("Fresh");
    expect(fired("A")).toEqual([]);
    expect(fired("C")).toEqual([]);
  });

  it("every rule explains itself with a reason and an action, fired or not", () => {
    for (const code of ["A", "B", "C", "D", "E"] as Code[]) {
      for (const r of evaluateFreshness(inputFor(code)).rules) {
        expect(r.reason.length).toBeGreaterThan(10);
        expect(r.action.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("rule thresholds", () => {
  const base: FreshnessInput = {
    asOfDate: "2026-09-30", approvalDays: 10, quoteDate: "2026-09-20", validUntil: "2026-12-31",
    referencesPriorPricing: false, priorPricingLines: [], foreignCurrencies: [], fxRates, memoryExposedLines: [], memoryIndex,
  };
  const status = (o: Partial<FreshnessInput>) => evaluateFreshness({ ...base, ...o });

  it("validity on the day approval completes is fine; a day earlier is Stale", () => {
    expect(status({ validUntil: "2026-10-10" }).status).toBe("Fresh");
    expect(status({ validUntil: "2026-10-09" }).status).toBe("Stale");
  });

  it("price basis: 30 days is fine, 31 Medium, 91 High", () => {
    expect(status({ quoteDate: "2026-08-31" }).status).toBe("Fresh");
    expect(status({ quoteDate: "2026-08-30" }).status).toBe("Reconfirm");
    expect(status({ quoteDate: "2026-07-01" }).status).toBe("Stale");
  });

  it("market movement only matters when memory-exposed lines are quoted", () => {
    expect(status({ quoteDate: "2026-06-04", memoryExposedLines: [] }).fired.map((r) => r.key)).not.toContain("market_movement");
    expect(status({ quoteDate: "2026-06-04", memoryExposedLines: [1] }).fired.map((r) => r.key)).toContain("market_movement");
  });

  it("FX only matters for foreign-currency quotes", () => {
    expect(status({ quoteDate: "2026-09-14" }).fired.map((r) => r.key)).not.toContain("fx_movement");
    expect(status({ quoteDate: "2026-09-14", foreignCurrencies: ["USD"] }).fired.map((r) => r.key)).toContain("fx_movement");
  });
});

describe("prior-pricing rule", () => {
  it("fires only when lines are shown at Meridian's last-cycle price", async () => {
    const { priorPricing } = await import("@/lib/freshness/rules");
    const base = { referencesPriorPricing: true, priorPricingLines: [] as number[] } as Parameters<typeof priorPricing>[0];
    expect(priorPricing(base).fired).toBe(false);
    expect(priorPricing({ ...base, priorPricingLines: [3, 5] }).fired).toBe(true);
  });
});
