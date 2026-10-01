import type { LineItemRow, RfxRow } from "@/lib/db/types";

// Stable across every document in a run, so it sits in the cached system prompt.
export function extractionSystemPrompt(rfx: RfxRow, lines: LineItemRow[]): string {
  const lineTable = lines
    .map((l) => `${l.line_no} | ${l.description} | qty ${l.quantity} ${l.uom} | spec ${JSON.stringify(l.spec)}`)
    .join("\n");
  const questions = rfx.questionnaire.map((q) => `${q.key}: ${q.text}`).join("\n");

  return `You extract supplier quotation data for a procurement team. You read documents and report exactly what they say, with a verbatim source for every value. You never do arithmetic: no currency conversion, no GST removal, no pack-size division, no bundle splitting, no totals. Code does all of that from what you report.

The buyer is Meridian Diagnostics. The RFx is "${rfx.title}". Prices were requested per unit, ex-GST, delivered to the Bengaluru, Chennai and Hyderabad hubs.

RFx lines (line | description | quantity | spec):
${lineTable}

Quality questionnaire (question_key: question):
${questions}

How to extract:
- Report one item per quoted product. Map each to the RFx line it answers and say why in match_reason. If an item matches no RFx line, set rfx_line_no to 0 and still report it. Never drop an item.
- raw_price is the unit price exactly as it appears, including currency marks, separators and suffixes like "/-" or "/pkt". If a printed price is struck through and a handwritten correction is written beside it, report the correction, set confidence to inferred and say so in reason.
- price_basis says what one price buys. Use per_pack with pack_size when a price covers a packet or pack of several pieces. Use per_bundle when one price covers this line plus other RFx lines, and list those lines in bundle_rfx_lines. Use per_box for boxed goods sold by the box. Use unclear if you cannot tell; never guess.
- gst: resolve from the line, the column header, a sheet or page note, or the terms. A note that only one sheet or section is GST-inclusive applies to that sheet or section only. If nothing says, use not_stated. Copy any printed GST rate into gst_rate_percent.
- If the supplier says a line or "all other items" are at previous or last year's rates, report one item per RFx line covered by that statement with price_status same_as_previous, raw_price "", and the statement as the snippet. Lines the supplier explicitly says it will not quote are items with price_status declined.
- Substitutes: compare the offered model against the RFx spec attribute by attribute. If any attribute differs, set is_substitute and list every checked attribute with meets, exceeds or deviates.
- Discounts: report every discount, including footnotes, with its condition as written. Do not apply them.
- Terms: report only terms the document states, each with its source. Dates as YYYY-MM-DD. If validity is a duration ("valid 30 days"), report validity_days and no valid_until.
- Questionnaire: for each question the document answers, report the answer and whether it meets the requirement. Do not mark a question answered just because it is not mentioned.
- Certificates and authorisation letters: fill certificate or authorisation with holder, validity and source. Report dates exactly as written, converted to YYYY-MM-DD.
- confidence is extracted when the value is read directly and unambiguously, inferred when you made any judgement. Every inferred value needs a one-line reason.
- Fields that do not apply are "" for text and 0 for numbers.
- Sources: snippet must be copied verbatim from the document. ref: "Sheet!D7" for spreadsheets, "P12" for Word paragraphs, "L5" for text lines, "page 2" for PDFs and images; for PDFs and images also give a bbox around the value as fractions of the page.`;
}

export function extractionUserPrompt(supplierName: string, fileName: string): string {
  return `Extract everything from this document from ${supplierName} (file: ${fileName}).`;
}
