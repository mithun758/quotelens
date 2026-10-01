import { z } from "zod";
import { documentToPdf } from "@/lib/export/pdf";
import { documentToXlsx } from "@/lib/export/xlsx";
import { defineTool } from "./define";

export const EXPORTS_BUCKET = "exports";

export const exportTool = defineTool({
  name: "export",
  description:
    "Exports a table from the answer as an Excel or PDF file and returns a download link valid for 24 hours. Copy rows from tool results; the post-check verifies them.",
  input: z.object({
    format: z.enum(["xlsx", "pdf"]),
    title: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
  }),
  output: z.object({ file_name: z.string(), url: z.string(), expires_in_hours: z.number() }),
  modelSuppliedNumbers: true,
  async run({ client }, input) {
    for (const [i, r] of input.rows.entries()) {
      if (r.length !== input.columns.length) throw new Error(`Row ${i + 1} has ${r.length} cells for ${input.columns.length} columns`);
    }
    const doc = {
      title: input.title,
      subtitle: "QuoteLens analyst export. INR per piece, ex-GST, delivered unless stated.",
      blocks: [{ type: "table" as const, title: input.title, header: input.columns, rows: input.rows.map((r) => r.map((c) => (c === null ? "" : String(c)))) }],
    };
    const isPdf = input.format === "pdf";
    const buffer = isPdf ? Buffer.from(await documentToPdf(doc)) : documentToXlsx(doc);
    const { data: bucket } = await client.storage.getBucket(EXPORTS_BUCKET);
    if (!bucket) await client.storage.createBucket(EXPORTS_BUCKET, { public: false });
    const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "export";
    const ext = isPdf ? "pdf" : "xlsx";
    const path = `analyst/${Date.now()}-${slug}.${ext}`;
    const up = await client.storage
      .from(EXPORTS_BUCKET)
      .upload(path, buffer, { contentType: isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    if (up.error) throw new Error(`upload export: ${up.error.message}`);
    const signed = await client.storage.from(EXPORTS_BUCKET).createSignedUrl(path, 24 * 60 * 60, { download: `${slug}.${ext}` });
    if (signed.error || !signed.data) throw new Error(`sign export: ${signed.error?.message}`);
    return { file_name: `${slug}.${ext}`, url: signed.data.signedUrl, expires_in_hours: 24 };
  },
});
