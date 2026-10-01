// Turns a stored supplier document into a content block for the extraction call.
// Excel, Word and plain text become text with addressable markers the model cites
// (cell refs, [Pn] paragraphs, [Ln] lines). PDFs and images go in natively.
import type Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export type PreparedDocument = {
  block: Anthropic.Beta.BetaContentBlockParam;
  // Plain text used to verify snippets; null for PDFs and images.
  text: string | null;
  kind: "spreadsheet" | "word" | "text" | "pdf" | "image";
};

function cellText(cell: XLSX.CellObject | undefined): string | null {
  if (!cell || cell.v === undefined || cell.v === null || cell.v === "") return null;
  const value = typeof cell.v === "string" ? `"${cell.v}"` : String(cell.v);
  return cell.f ? `${value} (formula =${cell.f})` : value;
}

export function spreadsheetToText(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { cellFormula: true });
  const out: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    out.push(`=== Sheet "${name}" ===`);
    const merges = (ws["!merges"] ?? []).map((m) => XLSX.utils.encode_range(m));
    if (merges.length) out.push(`Merged ranges: ${merges.join(", ")}`);
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1");
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cells: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const text = cellText(ws[addr]);
        if (text !== null) cells.push(`${addr}=${text}`);
      }
      if (cells.length) out.push(`Row ${r + 1}: ${cells.join(" | ")}`);
    }
  }
  return out.join("\n");
}

export async function wordToText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => `[P${i + 1}] ${p}`)
    .join("\n");
}

export function plainToText(buffer: Buffer): string {
  return buffer
    .toString("utf8")
    .split("\n")
    .map((line, i) => `[L${i + 1}] ${line}`)
    .join("\n");
}

function textBlock(fileName: string, text: string): Anthropic.Beta.BetaTextBlockParam {
  return { type: "text", text: `<document file_name="${fileName}">\n${text}\n</document>` };
}

export async function prepareDocument(fileName: string, mimeType: string, buffer: Buffer): Promise<PreparedDocument> {
  if (mimeType === "application/pdf") {
    return {
      kind: "pdf",
      text: null,
      block: { type: "document", title: fileName, source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
    };
  }
  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return {
      kind: "image",
      text: null,
      block: { type: "image", source: { type: "base64", media_type: mimeType, data: buffer.toString("base64") } },
    };
  }
  if (mimeType.includes("spreadsheetml")) {
    const text = spreadsheetToText(buffer);
    return { kind: "spreadsheet", text, block: textBlock(fileName, text) };
  }
  if (mimeType.includes("wordprocessingml")) {
    const text = await wordToText(buffer);
    return { kind: "word", text, block: textBlock(fileName, text) };
  }
  if (mimeType.startsWith("text/")) {
    const text = plainToText(buffer);
    return { kind: "text", text, block: textBlock(fileName, text) };
  }
  throw new Error(`Unsupported document type ${mimeType} for ${fileName}`);
}

// Whitespace, quote and marker-insensitive containment check for snippets.
export function snippetFound(snippet: string, text: string): boolean {
  const norm = (s: string) =>
    s
      .replace(/\[(?:P|L)\d+\]\s?/g, "")
      .replace(/[“”"']/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const needle = norm(snippet);
  return needle.length > 0 && norm(text).includes(needle);
}
