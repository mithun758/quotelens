import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { checkCitations, decodeLocator, docCite, encodeLocator, stripCitations } from "@/lib/ai/lens/citations";
import { splitNextSteps } from "@/lib/ai/lens/agent";
import { contextBlock, type LensPlaceholders } from "@/lib/ai/lens/context";
import { lensSystemPrompt } from "@/lib/ai/lens/prompt";
import { citationsToLinks, parseDocHref } from "@/components/analyst/cite";
import { ANALYST_TOOLS } from "@/lib/tools";

const VALUES: LensPlaceholders = {
  as_of_date: "30 Sep 2026",
  event_name: "IT Refresh 2026",
  customer_name: "Meridian Diagnostics",
  rfx_sent_date: "12 Sep 2026",
  need_by_date: "31 Oct 2026",
  approval_days: "10",
  screen: "comparison",
  selection: "none",
  event_state: "5 of 5 responses received",
  briefing_trigger: "false",
};

describe("Lens system prompt", () => {
  it("names exactly the tools the code registers", () => {
    const tools = lensSystemPrompt().match(/<tools>([\s\S]*?)<\/tools>/)![1];
    const named = [...tools.matchAll(/^- ([a-z_]+):/gm)].map((m) => m[1]).sort();
    expect(named).toEqual(ANALYST_TOOLS.map((t) => t.name).sort());
  });

  it("is static, so it can be cached; runtime values go in the context block", () => {
    const prompt = lensSystemPrompt();
    expect(prompt).not.toMatch(/\{\{/);
    expect(prompt).not.toContain("How to use this file");
    const block = contextBlock(VALUES);
    for (const v of Object.values(VALUES)) expect(block).toContain(v);
    expect(block.startsWith("<context>")).toBe(true);
  });

  it("is the only system prompt: the old analyst and co-pilot prompts are gone", () => {
    expect(fs.existsSync("lib/ai/analyst.ts")).toBe(false);
    expect(fs.existsSync("lib/ai/copilot.ts")).toBe(false);
    expect(lensSystemPrompt()).toContain("<signature_behaviour>");
  });

  it("splits a briefing's next steps out of the answer", () => {
    const r = splitNextSteps("Vertex is Stale.\n\n<next_steps>\n- Switch to Decision-ready\n2. Draft a reconfirmation to Vertex\n</next_steps>");
    expect(r.answer).toBe("Vertex is Stale.");
    expect(r.nextSteps).toEqual(["Switch to Decision-ready", "Draft a reconfirmation to Vertex"]);
  });
});

describe("citations", () => {
  const id = "0efd2723-8259-425c-8db2-2ec3760f49ad";
  it("round-trips document locators", () => {
    const loc = { page: 1, bbox: [0.1, 0.2, 0.3, 0.4] as [number, number, number, number] };
    expect(decodeLocator(encodeLocator(loc))).toEqual(loc);
    expect(decodeLocator(encodeLocator({ sheet: "Print & Power", cell: "B12" }))).toEqual({ sheet: "Print & Power", cell: "B12" });
    expect(docCite(id, { line: 17 })).toBe(`[[doc:${id}:line=17]]`);
  });

  it("removes citations that point at nothing, with a warning", () => {
    const text = `₹13,000 [[cell:B:4]] and ₹9 [[cell:Z:99]] from [[doc:${id}:page=1]] and [[doc:00000000-0000-0000-0000-000000000000:page=1]]`;
    const r = checkCitations(text, (s, n) => s === "B" && n === 4, (d) => d === id);
    expect(r.text).toContain("[[cell:B:4]]");
    expect(r.text).not.toContain("Z:99");
    expect(r.text).toContain(id);
    expect(r.warnings).toHaveLength(2);
    expect(stripCitations(r.text)).not.toMatch(/\[\[/);
  });

  it("become links the chat renders as cell and source chips", () => {
    const md = citationsToLinks(`₹13,000 [[cell:B:4]] see [[doc:${id}:sheet=Print%20%26%20Power;cell=B12]]`);
    expect(md).toContain("[B4](#cite-cell-B-4)");
    const href = md.match(/\(#cite-doc-[^)]+\)/)![0].slice(1, -1);
    expect(parseDocHref(href)).toEqual({ id, loc: "sheet=Print%20%26%20Power;cell=B12" });
  });
});

describe("cell citations sit beside their own figure", () => {
  const value = (s: string, n: number) => (s === "B" && n === 3 ? 1160 : null);
  const exists = () => true;
  it("keeps a citation next to the cell's price and drops one on a total", () => {
    const r = checkCitations("Vertex is L1 at ₹1,160 [[cell:B:3]]. The basket total is ₹55.18 lakh [[cell:B:3]].", exists, exists, value);
    expect(r.text).toBe("Vertex is L1 at ₹1,160 [[cell:B:3]]. The basket total is ₹55.18 lakh .");
    expect(r.warnings).toHaveLength(1);
  });
  it("keeps a citation with no figure beside it, such as a Missing cell", () => {
    expect(checkCitations("Lionbridge didn't quote line 23 [[cell:E:23]].", exists, exists, () => null).warnings).toHaveLength(0);
  });
});
