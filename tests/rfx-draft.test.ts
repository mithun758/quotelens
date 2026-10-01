import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, removeLines, sendProblems, setHeader, setQuestionnaire, setTerms, upsertLines, type DraftLine } from "@/lib/rfx/draft";

const line = (n: number, d = `Item ${n}`): DraftLine => ({ line_no: n, description: d, category: "Computing", spec: [{ attribute: "RAM", value: "16 GB" }], quantity: 10, uom: "piece", memory_exposed: false });

describe("RFx draft operations", () => {
  it("upserts by line number, appends new ones and keeps numbering 1..n", () => {
    let d = upsertLines(EMPTY_DRAFT, [line(1), line(2)]);
    d = upsertLines(d, [line(2, "Replaced"), line(9, "Appended")]);
    expect(d.lines.map((l) => [l.line_no, l.description])).toEqual([[1, "Item 1"], [2, "Replaced"], [3, "Appended"]]);
  });

  it("removes lines and renumbers", () => {
    const d = removeLines(upsertLines(EMPTY_DRAFT, [line(1), line(2), line(3)]), [2]);
    expect(d.lines.map((l) => [l.line_no, l.description])).toEqual([[1, "Item 1"], [2, "Item 3"]]);
  });

  it("rejects invalid lines and duplicate questionnaire keys", () => {
    expect(() => upsertLines(EMPTY_DRAFT, [{ ...line(1), quantity: 0 }])).toThrow();
    expect(() => setQuestionnaire(EMPTY_DRAFT, [{ key: "iso", text: "a", evidence_required: true }, { key: "iso", text: "b", evidence_required: false }])).toThrow();
    expect(() => setHeader(EMPTY_DRAFT, { need_by_date: "31/10/2026" })).toThrow();
  });

  it("lists what must be fixed before sending, and nothing once complete", () => {
    expect(sendProblems(EMPTY_DRAFT, "2026-09-30").length).toBeGreaterThan(3);
    let d = setHeader(EMPTY_DRAFT, { title: "IT Refresh", need_by_date: "2026-10-31", delivery_hubs: ["Bengaluru"] });
    d = upsertLines(d, [line(1)]);
    d = setQuestionnaire(d, [{ key: "iso_9001", text: "ISO 9001?", evidence_required: true }]);
    d = setTerms(d, { validity_days_required: 30, gst_basis: "ex-GST", warranty: "3 years onsite", payment: "45 days" });
    expect(sendProblems(d, "2026-09-30")).toEqual([]);
    expect(sendProblems({ ...d, need_by_date: "2026-09-01" }, "2026-09-30")).toEqual(["The need-by date must be after the as-of date."]);
  });
});
