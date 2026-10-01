import { ExtractPanel } from "@/components/quotes/ExtractPanel";
import { QuotesWorkspace } from "@/components/quotes/QuotesWorkspace";
import { SupplierRail } from "@/components/quotes/SupplierRail";
import { db } from "@/lib/db/client";
import { renderDocument } from "@/lib/documents/render";
import { loadFreshness } from "@/lib/freshness/load";
import { loadQuotes } from "@/lib/quotes/load";

export const metadata = { title: "Quotes · QuoteLens" };
export const dynamic = "force-dynamic";
// Receiving a reply re-extracts the supplier's documents with the model.
export const maxDuration = 300;

export default async function QuotesPage({ searchParams }: PageProps<"/quotes">) {
  const { supplier } = await searchParams;
  const client = db();
  const [{ rail, detail }, freshness, lineCount] = await Promise.all([
    loadQuotes(client, typeof supplier === "string" ? supplier.toUpperCase() : null),
    loadFreshness(client),
    client.from("line_item").select("id", { count: "exact", head: true }),
  ]);
  const documents = detail
    ? await Promise.all(detail.documents.map(async (d) => ({ id: d.id, file_name: d.file_name, mime_type: d.mime_type, model: await renderDocument(client, d) })))
    : [];

  const notExtracted = rail.filter((r) => r.response && r.response.status !== "extracted").map((r) => ({ code: r.supplier.code, name: r.supplier.name }));
  const extracted = detail?.response?.status === "extracted";

  return (
    <div className="space-y-5">
      {notExtracted.length > 0 && <ExtractPanel key={notExtracted.map((p) => p.code).join()} pending={notExtracted} />}
      <div className="flex gap-6">
        <SupplierRail rail={rail} selected={detail?.supplier.code ?? null} totalLines={lineCount.count ?? 30} />
        <div className="min-w-0 flex-1">
          {detail ? (
            <QuotesWorkspace key={detail.supplier.code} detail={detail} documents={documents} freshness={extracted ? (freshness[detail.supplier.code]?.status ?? null) : null} />
          ) : (
            <p className="text-sm text-slate">No supplier responses yet. Send the RFx from step 1 and responses will appear here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
