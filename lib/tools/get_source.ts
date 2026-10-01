import { z } from "zod";
import { docCite } from "@/lib/ai/lens/citations";
import type { SourceLocator } from "@/lib/db/types";
import { defineTool } from "./define";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const date = (iso: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export const getSource = defineTool({
  name: "get_source",
  description:
    "Where a cell's value came from: source document, location and verbatim snippet, the raw value as quoted, its confidence state and reason, and the full normalisation ledger.",
  input: z.object({ supplier: z.string(), line: z.number().int() }),
  output: z.object({
    supplier: z.string(),
    line: z.number(),
    description: z.string(),
    raw_value: z.string().nullable(),
    raw_unit: z.string().nullable(),
    raw_currency: z.string().nullable(),
    unit_inr: z.number().nullable(),
    confidence: z.string(),
    review_status: z.string(),
    reason: z.string().nullable(),
    document: z.string().nullable(),
    document_id: z.string().nullable(),
    location: z.record(z.string(), z.unknown()).nullable(),
    cite_cell: z.string().describe("Copy this after the price to cite the comparison cell"),
    cite_source: z.string().nullable().describe("Copy this after a figure or quote to cite the source document"),
    snippet: z.string().nullable(),
    ledger: z.array(z.object({ step: z.number(), kind: z.string(), input: z.number(), output: z.number(), rate: z.number().nullable(), rate_source: z.string().nullable(), rate_date: z.string().nullable() })),
    substitute_check: z.array(z.object({ attribute: z.string(), required: z.string(), offered: z.string(), result: z.string() })).nullable(),
    substitute_status: z.string().nullable(),
  }),
  run({ data }, input) {
    const code = input.supplier.toUpperCase();
    const line = data.lines.find((l) => l.line_no === input.line);
    if (!line) throw new Error(`No RFx line ${input.line}`);
    const c = data.cells[code]?.[input.line];
    const info = data.suppliers.find((s) => s.code === code);
    if (!info) throw new Error(`Unknown supplier ${input.supplier}`);
    if (!c) throw new Error(`${code} has no extracted value for line ${input.line}`);
    return {
      supplier: code,
      line: input.line,
      description: line.description,
      raw_value: c.raw_value,
      raw_unit: c.raw_unit,
      raw_currency: c.raw_currency,
      unit_inr: c.normalised_value_inr,
      confidence: c.confidence_state,
      review_status: c.status,
      reason: c.reason,
      document: c.source_document_id ? (info.documents[c.source_document_id] ?? null) : null,
      document_id: c.source_document_id,
      location: (c.source_locator as Record<string, unknown> | null) ?? null,
      cite_cell: `[[cell:${code}:${input.line}]]`,
      cite_source: c.source_document_id ? docCite(c.source_document_id, c.source_locator as SourceLocator | null) : null,
      snippet: c.source_snippet,
      ledger: c.steps.map((s) => ({ step: s.step_order, kind: s.kind, input: Number(s.input), output: Number(s.output), rate: s.rate === null ? null : Number(s.rate), rate_source: s.rate_source, rate_date: s.rate_date ? date(s.rate_date) : null })),
      substitute_check: c.substitute_check?.map((x) => ({ attribute: x.attribute, required: String(x.required), offered: String(x.offered), result: x.result })) ?? null,
      substitute_status: c.substitute_status,
    };
  },
});
