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
    expect(CLARIFICATION_REPLIES.map((r) => r.supplier_code)).toEqual(["E"]);
    const files = CLARIFICATION_REPLIES[0].documents.map((d) => d.file_name);
    expect(files).toEqual(expect.arrayContaining(["Lionbridge_ISO_9001_Certificate.pdf", "Lionbridge_OEM_Authorisation_HP.pdf"]));
    expect(CLARIFICATION_REPLIES[0].body_text).toMatch(/not able to quote the UPS units \(lines 17 and 18\) or the branch firewall \(line 23\)/);
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

  it("the demo beats hold", () => {
    const beats = groundTruth.demo_beats;
    expect(beats.cheapest_on_common_basket).toBe("B");
    expect(beats.d_nominal_l1_lines.length).toBeGreaterThanOrEqual(7);
    expect(beats.l1_by_line["1"]).toBe("E");
    expect(beats.l1_by_line["2"]).toBe("E");
  });
});
