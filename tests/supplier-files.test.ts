import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import groundTruth from "@/seed/ground_truth.json";
import { CLARIFICATION_REPLIES, SUPPLIER_RESPONSES } from "@/seed/suppliers";

const dir = path.join(process.cwd(), "seed", "suppliers");

describe("generated supplier files", () => {
  it("has one response per supplier A to E, and every manifest file exists", () => {
    expect(SUPPLIER_RESPONSES.map((r) => r.supplier_code)).toEqual(["A", "B", "C", "D", "E"]);
    for (const doc of [...SUPPLIER_RESPONSES, ...CLARIFICATION_REPLIES].flatMap((r) => r.documents)) {
      expect(existsSync(path.join(dir, doc.local_path)), doc.local_path).toBe(true);
    }
  });

  it("ground truth covers 30 lines per supplier with the planted coverage", () => {
    const coverage = Object.fromEntries(
      Object.entries(groundTruth.suppliers).map(([code, s]) => {
        expect(s.lines).toHaveLength(30);
        return [code, s.lines.filter((l) => l.quoted).length];
      }),
    );
    expect(coverage).toEqual({ A: 30, B: 28, C: 30, D: 20, E: 27 });
  });

  it("Missing is never given a value in ground truth", () => {
    for (const s of Object.values(groundTruth.suppliers)) {
      for (const l of s.lines) {
        if (l.expected_confidence === "missing") expect(l.expected_normalised_inr).toBeNull();
      }
    }
  });

  it("E's email declines lines 17, 18 and 23 and quotes six lines in USD", () => {
    const email = readFileSync(path.join(dir, "E", "Lionbridge_email_2026-09-14.txt"), "utf8");
    expect(email.match(/USD \d/g)).toHaveLength(6);
    expect(email).toContain("same as last year's rates");
    expect(email).toContain("Freight extra");
    expect(email.toLowerCase()).not.toContain("warranty");
  });

  it("E's clarification reply attaches ISO and OEM evidence and still declines 17, 18 and 23", () => {
    expect(CLARIFICATION_REPLIES.map((r) => r.supplier_code)).toEqual(["E", "D"]);
    const files = CLARIFICATION_REPLIES[0].documents.map((d) => d.file_name);
    expect(files).toEqual(expect.arrayContaining(["Lionbridge_ISO_9001_Certificate.pdf", "Lionbridge_OEM_Authorisation_HP.pdf"]));
    expect(CLARIFICATION_REPLIES[0].body_text).toMatch(/not able to quote the UPS units \(lines 17 and 18\) or the branch firewall \(line 23\)/);
  });

  it("D's reconfirmation reply reprices lines 5, 6 and 28 and states 15-day validity", () => {
    const d = CLARIFICATION_REPLIES.find((r) => r.supplier_code === "D")!;
    expect(d.documents.map((x) => x.file_name)).toEqual(["SriGanesh_reconfirmation_reply_2026-09-30.txt"]);
    for (const price of ["52,700", "39,270", "8,760"]) expect(d.body_text).toContain(price);
    expect(d.body_text).toMatch(/valid for 15 days from today \(30-Sep-2026\)/);
    expect(groundTruth.demo_beats.d_reconfirmation.after.l1_by_line).toEqual({ "5": "B", "6": "B", "28": "B" });
  });

  it("questionnaire: A and B pass; C, D and E-before fail; E-after passes", () => {
    const passes = (answers: Record<string, { result: string }>) => Object.values(answers).every((a) => a.result === "pass");
    const q = groundTruth.questionnaire;
    expect([q.A, q.B, q.C, q.D, q.E_before_clarification, q.E_after_clarification].map(passes)).toEqual([true, true, false, false, false, true]);
    expect(q.C.iso_9001.result).toBe("fail");
    expect(q.C.oem_authorisation.result).toBe("fail");
  });

  it("Q6 awards everything to A before clarification, and A plus E after, with E on both laptops", () => {
    const { before_clarification: before, after_clarification: after } = groundTruth.demo_beats.q6;
    expect(before.summary.suppliers).toEqual(["A"]);
    expect(after.summary.suppliers).toEqual(["A", "E"]);
    expect(after.allocation["1"].supplier).toBe("E");
    expect(after.allocation["2"].supplier).toBe("E");
  });

  it("after clarification E wins 3 to 5 lines besides laptops, at most 4 on prior pricing, and A plus E beats last cycle", () => {
    const after = groundTruth.demo_beats.q6.after_clarification.summary;
    const eOther = after.lines_by_supplier.E.filter((n) => n !== 1 && n !== 2);
    expect(eOther.length).toBeGreaterThanOrEqual(3);
    expect(eOther.length).toBeLessThanOrEqual(5);
    expect(after.lines_on_prior_pricing.length).toBeLessThanOrEqual(4);
    expect(after.saving_vs_last_cycle_inr).toBeGreaterThan(0);
  });

  it("the demo beats hold", () => {
    const beats = groundTruth.demo_beats;
    expect(beats.cheapest_on_common_basket).toBe("B");
    expect(beats.d_nominal_l1_lines.length).toBeGreaterThanOrEqual(7);
    expect(beats.l1_by_line["1"]).toBe("E");
    expect(beats.l1_by_line["2"]).toBe("E");
  });
});
