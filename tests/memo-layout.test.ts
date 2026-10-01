import { describe, expect, it } from "vitest";
import { memoLayout, statusIn } from "@/lib/award/memoLayout";

const memo = `## Recommendation
Award to Prakash and Vertex.

## Quote Freshness
- Prakash Distributors: Fresh. No rule fired.
- Vertex Systems: Stale. Valid until 1 Oct, approval completes 10 Oct.

## Overrides
None`;

describe("memo layout", () => {
  it("splits out the Quote Freshness section without changing the text", () => {
    const l = memoLayout(memo);
    expect(l.before).toBe("## Recommendation\nAward to Prakash and Vertex.");
    expect(l.after).toBe("## Overrides\nNone");
    expect(l.freshness?.items).toEqual([
      { status: "Fresh", text: "Prakash Distributors: Fresh. No rule fired." },
      { status: "Stale", text: "Vertex Systems: Stale. Valid until 1 Oct, approval completes 10 Oct." },
    ]);
  });

  it("leaves a memo without the section whole, and reads prose paragraphs as items", () => {
    expect(memoLayout("## Recommendation\nText").freshness).toBeNull();
    expect(memoLayout("## Quote Freshness\nNexa is Reconfirm.\n\nNone stale.").freshness?.items.map((i) => i.status)).toEqual(["Reconfirm", null]);
    expect(statusIn("Freshly baked")).toBeNull();
  });
});

describe("memo PDF", () => {
  it("lays out a typical memo on one A4 page", async () => {
    const { memoToPdf } = await import("@/lib/export/memoPdf");
    const { PDFDocument } = await import("pdf-lib");
    const bytes = await memoToPdf({ markdown: memo, date: "30 Sep 2026", rfxTitle: "IT Refresh 2026", warnings: ["₹1 (answer)"] });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(595.28, 1);
  });
});
