// Server-side PDF from an ExportDocument with pdf-lib (pure JavaScript, runs on Vercel).
// Noto Sans is embedded so ₹ and other symbols render.
import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Block, ExportDocument } from "./document";

const FONT_DIR = path.join(process.cwd(), "lib", "export", "fonts");
const A4 = { width: 595.28, height: 841.89 };
let MARGIN = 48;
const INK = rgb(0.09, 0.09, 0.11);
const MUTED = rgb(0.4, 0.4, 0.43);
const RULE = rgb(0.85, 0.85, 0.87);
const AMBER = rgb(0.55, 0.33, 0.02);

type Ctx = { doc: PDFDocument; page: PDFPage; y: number; regular: PDFFont; bold: PDFFont; scale: number };

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) out.push(line);
        // A single word wider than the column is hard-broken.
        let w = word;
        while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
          let cut = w.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
          out.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN) {
    ctx.page = ctx.doc.addPage([A4.width, A4.height]);
    ctx.y = A4.height - MARGIN;
  }
}

function text(ctx: Ctx, value: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gapAfter?: number } = {}) {
  const size = (opts.size ?? 10) * ctx.scale;
  const font = opts.bold ? ctx.bold : ctx.regular;
  const x = MARGIN + (opts.indent ?? 0);
  for (const line of wrap(value, font, size, A4.width - MARGIN - x)) {
    ensure(ctx, size * 1.45);
    ctx.page.drawText(line, { x, y: ctx.y - size, size, font, color: opts.color ?? INK });
    ctx.y -= size * (ctx.scale < 1 ? 1.35 : 1.45);
  }
  ctx.y -= (opts.gapAfter ?? 6) * ctx.scale;
}

function table(ctx: Ctx, block: Extract<Block, { type: "table" }>) {
  const size = 8.5 * ctx.scale;
  const width = A4.width - 2 * MARGIN;
  const all = [block.header, ...block.rows];
  const cols = block.header.length;
  // Column widths in proportion to their longest content, with a floor.
  const weights = Array.from({ length: cols }, (_, c) => Math.max(4, ...all.map((r) => (r[c] ?? "").length)));
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.max(40, (w / total) * width));
  const scale = width / widths.reduce((a, b) => a + b, 0);
  const colW = widths.map((w) => w * scale);
  if (block.title) text(ctx, block.title, { size: 9, bold: true, gapAfter: 2 });

  all.forEach((row, r) => {
    const font = r === 0 ? ctx.bold : ctx.regular;
    const wrapped = colW.map((w, c) => wrap(row[c] ?? "", font, size, w - 6));
    const h = Math.max(...wrapped.map((l) => l.length)) * size * 1.35 + 5;
    ensure(ctx, h);
    let x = MARGIN;
    wrapped.forEach((lines, c) => {
      lines.forEach((l, i) => ctx.page.drawText(l, { x: x + 3, y: ctx.y - 3 - size - i * size * 1.35, size, font, color: INK }));
      x += colW[c];
    });
    ctx.y -= h;
    ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: MARGIN + width, y: ctx.y }, thickness: r === 0 ? 0.8 : 0.4, color: RULE });
  });
  ctx.y -= 10;
}

// compact: tighter type and spacing so a one-page memo stays on one page.
export async function documentToPdf(doc: ExportDocument, { compact = false } = {}): Promise<Uint8Array> {
  MARGIN = compact ? 40 : 48;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(readFileSync(path.join(FONT_DIR, "NotoSans_400Regular.ttf")), { subset: false });
  const bold = await pdf.embedFont(readFileSync(path.join(FONT_DIR, "NotoSans_700Bold.ttf")), { subset: false });
  pdf.setTitle(doc.title);
  pdf.setProducer("QuoteLens");
  const ctx: Ctx = { doc: pdf, page: pdf.addPage([A4.width, A4.height]), y: A4.height - MARGIN, regular, bold, scale: compact ? 0.9 : 1 };

  text(ctx, doc.title, { size: 16, bold: true, gapAfter: 2 });
  if (doc.subtitle) text(ctx, doc.subtitle, { size: 9, color: MUTED, gapAfter: 12 });

  for (const b of doc.blocks) {
    if (b.type === "heading") text(ctx, b.text, { size: b.level === 1 ? 13 : b.level === 2 ? 11.5 : 10.5, bold: true, gapAfter: 4 });
    else if (b.type === "paragraph") text(ctx, b.text, { color: b.tone === "muted" ? MUTED : b.tone === "warning" ? AMBER : INK });
    else if (b.type === "list") {
      for (const item of b.items) text(ctx, `•  ${item}`, { indent: 6, gapAfter: 2 });
      ctx.y -= 4;
    } else table(ctx, b);
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`QuoteLens · ${doc.title} · page ${i + 1} of ${pages.length}`, { x: MARGIN, y: 24, size: 7.5, font: regular, color: MUTED }));
  return pdf.save();
}
