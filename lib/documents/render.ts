// Renders a stored document for the Quotes screen so a source can be highlighted:
// spreadsheets by cell, Word paragraphs by [Pn], text by [Ln], PDFs and images by page + bbox.
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import type { Db } from "@/lib/db/client";
import { SUPPLIER_DOCUMENTS_BUCKET, downloadDocument } from "@/lib/db/storage";
import type { DocumentRow } from "@/lib/db/types";

export type SheetModel = {
  name: string;
  columns: string[];
  rows: { r: number; cells: { addr: string; text: string; colSpan: number; rowSpan: number; hidden: boolean }[] }[];
};

export type DocumentModel =
  | { kind: "spreadsheet"; sheets: SheetModel[] }
  | { kind: "lines"; marker: "P" | "L"; lines: { n: number; text: string }[] }
  | { kind: "pdf"; url: string }
  | { kind: "image"; url: string };

function formatCell(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  if (typeof cell.v === "number") return cell.v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return String(cell.v);
}

function spreadsheetModel(buffer: Buffer): DocumentModel {
  const wb = XLSX.read(buffer);
  const sheets = wb.SheetNames.map((name): SheetModel => {
    const ws = wb.Sheets[name];
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1");
    const merges = ws["!merges"] ?? [];
    const covered = new Set<string>();
    const spans = new Map<string, { cols: number; rows: number }>();
    const mergedRows = new Set<number>();
    for (const m of merges) {
      spans.set(XLSX.utils.encode_cell(m.s), { cols: m.e.c - m.s.c + 1, rows: m.e.r - m.s.r + 1 });
      for (let r = m.s.r; r <= m.e.r; r++) mergedRows.add(r);
      for (let r = m.s.r; r <= m.e.r; r++)
        for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) covered.add(XLSX.utils.encode_cell({ r, c }));
    }
    const columns: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) columns.push(XLSX.utils.encode_col(c));
    const rows: SheetModel["rows"] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cells = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const span = spans.get(addr);
        cells.push({ addr, text: formatCell(ws[addr]), colSpan: span?.cols ?? 1, rowSpan: span?.rows ?? 1, hidden: covered.has(addr) });
      }
      // Keep rows inside a merge so row spans stay aligned.
      if (cells.some((c) => c.text) || mergedRows.has(r)) rows.push({ r: r + 1, cells });
    }
    return { name, columns, rows };
  });
  return { kind: "spreadsheet", sheets };
}

export async function renderDocument(client: Db, doc: DocumentRow): Promise<DocumentModel> {
  if (doc.mime_type === "application/pdf" || doc.mime_type.startsWith("image/")) {
    const { data, error } = await client.storage.from(SUPPLIER_DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, 60 * 60);
    if (error || !data) throw new Error(`sign ${doc.storage_path}: ${error?.message}`);
    return { kind: doc.mime_type === "application/pdf" ? "pdf" : "image", url: data.signedUrl };
  }
  const buffer = await downloadDocument(client, doc.storage_path);
  if (doc.mime_type.includes("spreadsheetml")) return spreadsheetModel(buffer);
  if (doc.mime_type.includes("wordprocessingml")) {
    const { value } = await mammoth.extractRawText({ buffer });
    const paragraphs = value.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    return { kind: "lines", marker: "P", lines: paragraphs.map((text, i) => ({ n: i + 1, text })) };
  }
  return { kind: "lines", marker: "L", lines: buffer.toString("utf8").split("\n").map((text, i) => ({ n: i + 1, text })) };
}
