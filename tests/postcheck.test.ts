import { describe, expect, it } from "vitest";
import { collectNumbers, extractNumbers, postCheck } from "@/lib/ai/postcheck";

describe("number post-check", () => {
  const pool = collectNumbers({ total_inr: 9351720, total_display: "₹93.52 lakh", pct: 1.805, lines: [5, 6, 9, 10, 19, 21, 24, 26, 28], saving_inr: -131970, date: "2026-09-30" });

  it("reads Indian grouping, currency, percentages, lakh and crore", () => {
    expect(extractNumbers("₹1,05,000 and 93.52 lakh, 1.40 crore, +1.8%").map((t) => t.value)).toEqual([105000, 9352000, 14000000, 1.8]);
  });

  it("accepts numbers that appear in tool results at the precision used", () => {
    expect(postCheck("B is cheapest at ₹93.52 lakh (₹93,51,720). USD/INR moved 1.8%.", pool)).toEqual([]);
  });

  it("accepts counts of returned lists and dates from tool strings", () => {
    expect(postCheck("D is L1 on 9 lines as of 30 Sep 2026.", pool)).toEqual([]);
  });

  it("accepts a negative saving stated as an amount above last cycle", () => {
    expect(postCheck("That is ₹1,31,970 above last cycle.", pool)).toEqual([]);
  });

  it("flags numbers no tool returned", () => {
    expect(postCheck("B saves ₹2,10,000 overall.", pool).map((w) => w.text)).toEqual(["₹2,10,000"]);
    expect(postCheck("about 95 lakh", pool).map((w) => w.text)).toEqual(["95 lakh"]);
  });

  it("ignores numbers inside links", () => {
    expect(postCheck("[Download](https://x.supabase.co/storage/v1/object/sign/exports/analyst/1790826546506-totals.xlsx?token=abc123)", [])).toEqual([]);
  });

  it("ignores digits that are part of labels", () => {
    expect(postCheck("L1 on the 14th Gen Cat6 line, 1TB SSD", [])).toEqual([]);
  });
});
