import { z } from "zod";
import { draftClarification } from "@/lib/ai/clarification/draft";
import { loadQuotes } from "@/lib/quotes/load";
import { defineTool } from "./define";

export const draftClarificationTool = defineTool({
  name: "draft_clarification",
  description:
    "Drafts a specific clarification email to a supplier about its open review items (chosen lines, its questionnaire failures, or its quote-level flags). It is only a draft: Priya reviews and sends it from the Quotes screen.",
  input: z.object({
    supplier: z.string(),
    lines: z.array(z.number().int()).optional().describe("RFx lines to ask about"),
    include_questionnaire: z.boolean().optional(),
    include_quote_flags: z.boolean().optional().describe("Quote-level flags such as freight or discounts"),
    other_issues: z
      .array(z.string())
      .optional()
      .describe("Issues that are not review items, stated from tool results, e.g. 'Quote valid until 1 Oct 2026; approval completes 10 Oct 2026; please extend validity'"),
  }),
  output: z.object({ supplier: z.string(), issues: z.array(z.string()), subject: z.string(), body: z.string(), note: z.string() }),
  async run({ client, data }, input) {
    const code = input.supplier.toUpperCase();
    const { detail } = await loadQuotes(client, code);
    if (!detail || detail.supplier.code !== code) throw new Error(`Unknown supplier ${input.supplier}`);
    const items = detail.queue.filter(
      (i) =>
        (i.lineNo !== null && input.lines?.includes(i.lineNo)) ||
        (input.include_questionnaire && i.kind === "questionnaire") ||
        (input.include_quote_flags && i.kind === "response_flag"),
    );
    const others = (input.other_issues ?? []).filter((x) => x.trim());
    if (!items.length && !others.length) throw new Error(`No open review items for ${code} match. Open items: ${detail.queue.map((i) => i.headline).join("; ") || "none"}. Use other_issues for anything else.`);
    const draft = await draftClarification(client, {
      supplierName: detail.supplier.name,
      supplierCode: code,
      rfxTitle: data.rfx.title,
      issues: [
        ...items.map((i) => ({ label: i.kind === "questionnaire" ? "Quality questionnaire" : i.headline, detail: i.detail ?? i.flags.map((f) => f.message).join(" ") })),
        ...others.map((o) => ({ label: "Also", detail: o })),
      ],
    });
    return {
      supplier: code,
      issues: [...items.map((i) => i.headline), ...others],
      ...draft,
      note: items.length ? "Draft only. Priya sends it from the Quotes screen (Ask supplier)." : "Draft only. Sending from QuoteLens covers review items; copy this into email for issues outside the queue.",
    };
  },
});
