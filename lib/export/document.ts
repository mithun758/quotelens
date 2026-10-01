// A small document model shared by the PDF and Excel exporters (analyst answers now,
// the award memo later), plus a parser for the markdown the analyst writes.

export type Block =
  | { type: "heading"; text: string; level: 1 | 2 | 3 }
  | { type: "paragraph"; text: string; tone?: "muted" | "warning" }
  | { type: "list"; items: string[] }
  | { type: "table"; title?: string; header: string[]; rows: string[][] };

export type ExportDocument = { title: string; subtitle?: string; blocks: Block[] };

// Inline markdown to plain text: bold, italics, code, links.
export function plain(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => plain(c.trim()));

export function markdownToBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", text: plain(para.join(" ")) });
    if (list.length) blocks.push({ type: "list", items: list });
    para = [];
    list = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isRow = (l: string | undefined) => !!l && /^\s*\|.*\|\s*$/.test(l);
    if (isRow(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      flush();
      const header = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (isRow(lines[i])) rows.push(cells(lines[i++]));
      i--;
      blocks.push({ type: "table", header, rows });
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: plain(heading[2]) });
      continue;
    }
    const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (item) {
      if (para.length) {
        blocks.push({ type: "paragraph", text: plain(para.join(" ")) });
        para = [];
      }
      list.push(plain(item[1]));
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (list.length) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}
