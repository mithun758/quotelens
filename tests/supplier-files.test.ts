import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import groundTruth from "@/seed/ground_truth.json";
import { SUPPLIER_RESPONSES } from "@/seed/suppliers";

const dir = path.join(process.cwd(), "seed", "suppliers");

describe("generated supplier files", () => {
  it("has one response per supplier A to E, and every manifest file exists", () => {
    expect(SUPPLIER_RESPONSES.map((r) => r.supplier_code)).toEqual(["A", "B", "C", "D", "E"]);
    for (const doc of SUPPLIER_RESPONSES.flatMap((r) => r.documents)) {
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

  it("the demo beats hold", () => {
    const beats = groundTruth.demo_beats;
    expect(beats.cheapest_on_common_basket).toBe("B");
    expect(beats.d_nominal_l1_lines.length).toBeGreaterThanOrEqual(7);
    expect(beats.l1_by_line["1"]).toBe("E");
    expect(beats.l1_by_line["2"]).toBe("E");
  });
});
