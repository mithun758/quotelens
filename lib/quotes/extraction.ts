// Extraction and mapping summary per supplier, from the stored extraction. Pure.
import type { SupplierDetail } from "./load";

export type ExtractionSummary = { found: number; mapped: number; needsReview: number; missing: number };

export function extractionSummary(detail: Pick<SupplierDetail, "values" | "queue">, totalLines: number): ExtractionSummary {
  const priced = detail.values.filter((v) => v.field === "unit_price" && v.line_no !== null && v.confidence_state !== "missing");
  const unmatched = detail.values.filter((v) => v.field === "unmatched_item").length;
  const mappedLines = new Set(priced.map((v) => v.line_no)).size;
  return {
    // Priced items read from the documents, whether or not they matched an RFx line.
    found: priced.length + unmatched,
    mapped: mappedLines,
    needsReview: detail.queue.length,
    missing: totalLines - mappedLines,
  };
}
