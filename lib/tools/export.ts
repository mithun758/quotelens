import { z } from "zod";
import * as XLSX from "xlsx";
import { defineTool } from "./define";

export const EXPORTS_BUCKET = "exports";

export const exportTool = defineTool({
  name: "export",
  description:
    "Exports a table from the answer as an Excel file and returns a download link valid for 24 hours. Copy rows from tool results. PDF export is not available yet; offer Excel.",
  input: z.object({
    format: z.enum(["xlsx", "pdf"]),
    title: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
  }),
  output: z.object({ file_name: z.string(), url: z.string(), expires_in_hours: z.number() }),
  modelSuppliedNumbers: true,
  async run({ client }, input) {
    if (input.format === "pdf") throw new Error("PDF export is not available yet (it arrives with the award memo). Offer Excel instead.");
    for (const [i, r] of input.rows.entries()) {
      if (r.length !== input.columns.length) throw new Error(`Row ${i + 1} has ${r.length} cells for ${input.columns.length} columns`);
    }
    const ws = XLSX.utils.aoa_to_sheet([[input.title], [], input.columns, ...input.rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const { data: bucket } = await client.storage.getBucket(EXPORTS_BUCKET);
    if (!bucket) await client.storage.createBucket(EXPORTS_BUCKET, { public: false });
    const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "export";
    const path = `analyst/${Date.now()}-${slug}.xlsx`;
    const up = await client.storage.from(EXPORTS_BUCKET).upload(path, buffer, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    if (up.error) throw new Error(`upload export: ${up.error.message}`);
    const signed = await client.storage.from(EXPORTS_BUCKET).createSignedUrl(path, 24 * 60 * 60, { download: `${slug}.xlsx` });
    if (signed.error || !signed.data) throw new Error(`sign export: ${signed.error?.message}`);
    return { file_name: `${slug}.xlsx`, url: signed.data.signedUrl, expires_in_hours: 24 };
  },
});
