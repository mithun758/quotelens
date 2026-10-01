import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { markdownToBlocks } from "@/lib/export/document";
import { documentToPdf } from "@/lib/export/pdf";
import { documentToXlsx } from "@/lib/export/xlsx";

const ANSWER = `This depends on a **Stale** quote.

**B is cheapest** at ₹55.18 lakh.

| Supplier | Total | Change |
|---|---|---|
| B Vertex | ₹55,18,000 | -4.47% |
| A Prakash | ₹57,08,000 | -1.18% |

- B is Stale
- A is Fresh`;

describe("markdownToBlocks", () => {
  it("reads paragraphs, tables and lists and strips inline markdown", () => {
    const blocks = markdownToBlocks(ANSWER);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph", "table", "list"]);
    expect(blocks[1]).toEqual({ type: "paragraph", text: "B is cheapest at ₹55.18 lakh." });
    expect(blocks[2]).toMatchObject({ header: ["Supplier", "Total", "Change"], rows: [["B Vertex", "₹55,18,000", "-4.47%"], ["A Prakash", "₹57,08,000", "-1.18%"]] });
  });
});

describe("exporters", () => {
  const doc = { title: "Who is cheapest?", subtitle: "QuoteLens analyst", blocks: markdownToBlocks(ANSWER) };

  it("writes tables as real numbers in Excel", () => {
    const wb = XLSX.read(documentToXlsx(doc));
    expect(wb.SheetNames).toEqual(["Answer", "Table 1"]);
    const t = wb.Sheets["Table 1"];
    expect(t.B2.v).toBe(5518000);
    expect(t.C2.v).toBeCloseTo(-0.0447, 6);
  });

  it("writes a PDF with ₹ text and a long table across pages", async () => {
    const long = { ...doc, blocks: [...doc.blocks, { type: "table" as const, header: ["Line", "Price"], rows: Array.from({ length: 80 }, (_, i) => [`${i + 1}`, `₹${(i + 1) * 1000}`]) }] };
    const bytes = await documentToPdf(long);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toBe("Who is cheapest?");
  });
});
