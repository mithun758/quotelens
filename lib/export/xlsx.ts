// Excel from an ExportDocument: the full text on one sheet, every table on its own sheet.
// Plain rupee amounts and percentages become real numbers so Excel can sum them.
import * as XLSX from "xlsx";
import type { ExportDocument } from "./document";

const INR_FMT = "#,##,##0.##";

function cellValue(text: string): XLSX.CellObject {
  const money = text.match(/^(-|−)?₹?\s?(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?|\d+(?:\.\d+)?)$/);
  if (money) {
    const v = Number(money[2].replace(/,/g, "")) * (money[1] ? -1 : 1);
    return { t: "n", v, z: text.includes("₹") ? INR_FMT : undefined };
  }
  const pct = text.match(/^([+-−]?\d+(?:\.\d+)?)%$/);
  if (pct) return { t: "n", v: Number(pct[1].replace("−", "-")) / 100, z: "0.00%" };
  return { t: "s", v: text };
}

export function documentToXlsx(doc: ExportDocument): Buffer {
  const wb = XLSX.utils.book_new();
  const textRows: string[][] = [[doc.title], ...(doc.subtitle ? [[doc.subtitle]] : []), []];
  for (const b of doc.blocks) {
    if (b.type === "heading" || b.type === "paragraph") textRows.push([b.text], []);
    else if (b.type === "list") textRows.push(...b.items.map((i) => [`• ${i}`]), []);
    else textRows.push([`[Table: ${b.title ?? b.header.join(", ")}]`], []);
  }
  const textSheet = XLSX.utils.aoa_to_sheet(textRows);
  textSheet["!cols"] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(wb, textSheet, "Answer");

  doc.blocks
    .filter((b): b is Extract<typeof b, { type: "table" }> => b.type === "table")
    .forEach((t, i) => {
      const ws = XLSX.utils.aoa_to_sheet([t.header]);
      t.rows.forEach((row, r) => row.forEach((c, col) => (ws[XLSX.utils.encode_cell({ r: r + 1, c: col })] = cellValue(c))));
      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: t.rows.length, c: Math.max(t.header.length - 1, 0) } });
      ws["!cols"] = t.header.map((h, c) => ({ wch: Math.min(60, Math.max(h.length, ...t.rows.map((r) => (r[c] ?? "").length)) + 2) }));
      XLSX.utils.book_append_sheet(wb, ws, (t.title ?? `Table ${i + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    });
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
