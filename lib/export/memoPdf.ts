// The award memo as a PDF laid out like the Award screen's preview: letterhead, title,
// To/From/Date/RFx, ruled sections, tables in the comparison style, the Quote Freshness
// section with stamps, and the approval box. Formatting only; the memo text is as
// generated. pdf-lib with Noto Sans embedded, so ₹ renders.
import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { memoLayout, type FreshnessStatus } from "@/lib/award/memoLayout";
import { markdownToBlocks, plain, type Block } from "./document";

const FONT_DIR = path.join(process.cwd(), "lib", "export", "fonts");
const A4 = { width: 595.28, height: 841.89 };
const M = 44;
const W = A4.width - 2 * M;
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
// The app's tokens.
const C = { ink: hex("#1B2A41"), slate: hex("#5B6676"), rule: hex("#D9DCD6"), ruleStrong: hex("#C4C8C1"), ledger: hex("#2F6B4F"), pencil: hex("#8A5A12"), amber: hex("#B7791F"), amberTint: hex("#FBF3E4"), oxblood: hex("#9B2C2C") };
const STAMP: Record<FreshnessStatus, { line: RGB; text: RGB }> = { Fresh: { line: C.ledger, text: C.ledger }, Reconfirm: { line: C.amber, text: C.pencil }, Stale: { line: C.oxblood, text: C.oxblood } };

export type MemoPdfInput = { markdown: string; date: string; rfxTitle: string; warnings: string[] };

type Ctx = { pdf: PDFDocument; page: PDFPage; y: number; regular: PDFFont; bold: PDFFont };

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < M + 16) {
    ctx.page = ctx.pdf.addPage([A4.width, A4.height]);
    ctx.y = A4.height - M;
  }
}

function text(ctx: Ctx, value: string, o: { size?: number; bold?: boolean; color?: RGB; x?: number; width?: number; lead?: number; after?: number } = {}) {
  const size = o.size ?? 8.8;
  const font = o.bold ? ctx.bold : ctx.regular;
  const x = o.x ?? M;
  const lead = o.lead ?? size * 1.34;
  for (const line of wrap(value, font, size, o.width ?? M + W - x)) {
    ensure(ctx, lead);
    ctx.page.drawText(line, { x, y: ctx.y - size, size, font, color: o.color ?? C.ink });
    ctx.y -= lead;
  }
  ctx.y -= o.after ?? 4;
}

const rule = (ctx: Ctx, thickness: number, color: RGB, after = 0) => {
  ctx.page.drawLine({ start: { x: M, y: ctx.y }, end: { x: M + W, y: ctx.y }, thickness, color });
  ctx.y -= after;
};

// Section headings at 16px in the preview: 12pt here, with a hairline beneath.
function heading(ctx: Ctx, value: string) {
  ensure(ctx, 40);
  ctx.y -= 4;
  text(ctx, value, { size: 11, bold: true, after: 2 });
  rule(ctx, 0.5, C.rule, 5);
}

const numeric = (s: string) => /^[\s₹$+\-−.,%\d]+(lakh|crore)?[\s.,%]*$/i.test(s) && /\d/.test(s);

// Tables in the comparison's style: slate header, a stronger rule under it, hairlines
// between rows, figures right-aligned.
function table(ctx: Ctx, b: Extract<Block, { type: "table" }>) {
  const size = 8;
  const all = [b.header, ...b.rows];
  const cols = b.header.length;
  const weights = Array.from({ length: cols }, (_, c) => Math.max(4, ...all.map((r) => (r[c] ?? "").length)));
  const total = weights.reduce((a, x) => a + x, 0);
  const raw = weights.map((w) => Math.max(44, (w / total) * W));
  const scale = W / raw.reduce((a, x) => a + x, 0);
  const colW = raw.map((w) => w * scale);
  const right = Array.from({ length: cols }, (_, c) => b.rows.length > 0 && b.rows.every((r) => !r[c] || numeric(r[c])));
  all.forEach((row, r) => {
    const font = r === 0 ? ctx.bold : ctx.regular;
    const color = r === 0 ? C.slate : C.ink;
    const sz = r === 0 ? 7.5 : size;
    const lines = colW.map((w, c) => wrap(row[c] ?? "", font, sz, w - 10));
    const h = Math.max(...lines.map((l) => l.length)) * sz * 1.32 + 6;
    ensure(ctx, h);
    let x = M;
    lines.forEach((ls, c) => {
      ls.forEach((l, i) => {
        const tx = right[c] ? x + colW[c] - 5 - font.widthOfTextAtSize(l, sz) : x + 5;
        ctx.page.drawText(l, { x: tx, y: ctx.y - 3 - sz - i * sz * 1.32, size: sz, font, color });
      });
      x += colW[c];
    });
    ctx.y -= h;
    rule(ctx, r === 0 ? 1.5 : 0.5, r === 0 ? C.ruleStrong : C.rule);
  });
  ctx.y -= 8;
}

function blocks(ctx: Ctx, list: Block[]) {
  for (const b of list) {
    if (b.type === "heading") heading(ctx, b.text);
    else if (b.type === "paragraph") text(ctx, b.text, { color: b.tone === "muted" ? C.slate : C.ink });
    else if (b.type === "list") {
      for (const item of b.items) {
        const before = ctx.y;
        text(ctx, item, { x: M + 12, after: 2 });
        ctx.page.drawText("•", { x: M + 3, y: before - 8.8, size: 8.8, font: ctx.regular, color: C.ink });
      }
      ctx.y -= 4;
    } else table(ctx, b);
  }
}

// The freshness stamp: a 1.1pt border with a hairline inside it, no fill, sentence case.
function stamp(ctx: Ctx, status: FreshnessStatus, x: number, top: number): number {
  const size = 7.5;
  const w = ctx.bold.widthOfTextAtSize(status, size) + 12;
  const h = 14;
  const { line, text: color } = STAMP[status];
  ctx.page.drawRectangle({ x, y: top - h, width: w, height: h, borderColor: line, borderWidth: 1.1 });
  ctx.page.drawRectangle({ x: x + 2, y: top - h + 2, width: w - 4, height: h - 4, borderColor: line, borderWidth: 0.4 });
  ctx.page.drawText(status, { x: x + 6, y: top - h + 4.2, size, font: ctx.bold, color });
  return w;
}

function approvalBox(ctx: Ctx) {
  const h = 56;
  // The box may sit in the bottom margin, above the page footer.
  if (ctx.y - (h + 10) < 34) {
    ctx.page = ctx.pdf.addPage([A4.width, A4.height]);
    ctx.y = A4.height - M;
  }
  ctx.y -= 10;
  const top = ctx.y;
  ctx.page.drawRectangle({ x: M, y: top - h, width: W, height: h, borderColor: C.ruleStrong, borderWidth: 0.8 });
  const half = (W - 36) / 2;
  [
    { x: M + 12, label: "Approved by", note: "Meera, Head of Commercial Finance" },
    { x: M + 24 + half, label: "Date", note: "" },
  ].forEach((c) => {
    ctx.page.drawText(c.label, { x: c.x, y: top - 18, size: 8, font: ctx.regular, color: C.slate });
    ctx.page.drawLine({ start: { x: c.x, y: top - 36 }, end: { x: c.x + half, y: top - 36 }, thickness: 0.6, color: C.slate });
    if (c.note) ctx.page.drawText(c.note, { x: c.x, y: top - 48, size: 8, font: ctx.regular, color: C.slate });
  });
  ctx.y = top - h;
}

export async function memoToPdf(input: MemoPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(readFileSync(path.join(FONT_DIR, "NotoSans_400Regular.ttf")), { subset: false });
  const bold = await pdf.embedFont(readFileSync(path.join(FONT_DIR, "NotoSans_700Bold.ttf")), { subset: false });
  pdf.setTitle(`Award recommendation: ${input.rfxTitle}`);
  pdf.setProducer("QuoteLens");
  const ctx: Ctx = { pdf, page: pdf.addPage([A4.width, A4.height]), y: A4.height - M, regular, bold };

  // Letterhead, title and the To/From/Date/RFx list, as on the preview.
  text(ctx, "Meridian Diagnostics, Procurement", { size: 8, bold: true, color: C.slate, after: 4 });
  text(ctx, "Award recommendation", { size: 16, bold: true, after: 6 });
  for (const [k, v] of [
    ["To", "Meera, Head of Commercial Finance"],
    ["From", "Priya, Category Buyer"],
    ["Date", input.date],
    ["RFx", input.rfxTitle],
  ]) {
    ctx.page.drawText(k, { x: M, y: ctx.y - 8.8, size: 8.8, font: regular, color: C.slate });
    text(ctx, v, { x: M + 64, after: 1 });
  }
  ctx.y -= 6;
  rule(ctx, 1.5, C.ink, 10);

  if (input.warnings.length) {
    const before = ctx.y;
    text(ctx, `Post-check: ${input.warnings.join("; ")}.`, { size: 8, color: C.pencil, x: M + 8, after: 6 });
    ctx.page.drawLine({ start: { x: M + 1, y: before }, end: { x: M + 1, y: ctx.y + 6 }, thickness: 1.5, color: C.amber });
  }

  const layout = memoLayout(input.markdown);
  blocks(ctx, markdownToBlocks(layout.before));
  if (layout.freshness) {
    heading(ctx, layout.freshness.heading);
    for (const item of layout.freshness.items) {
      const value = plain(item.text);
      ensure(ctx, 18);
      const top = ctx.y;
      const indent = item.status ? stamp(ctx, item.status, M, top - 1) + 8 : 0;
      text(ctx, value, { x: M + indent, after: 5 });
      if (item.status) ctx.y = Math.min(ctx.y, top - 19);
    }
  }
  blocks(ctx, markdownToBlocks(layout.after));
  approvalBox(ctx);

  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`QuoteLens, Award recommendation, page ${i + 1} of ${pages.length}`, { x: M, y: 24, size: 7.5, font: regular, color: C.slate }));
  return pdf.save();
}
