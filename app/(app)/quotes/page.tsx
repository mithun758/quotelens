import { QuotesWorkspace } from "@/components/quotes/QuotesWorkspace";
import { SupplierRail } from "@/components/quotes/SupplierRail";
import { db } from "@/lib/db/client";
import { renderDocument } from "@/lib/documents/render";
import { loadQuotes } from "@/lib/quotes/load";

export const metadata = { title: "Quotes · QuoteLens" };
export const dynamic = "force-dynamic";
// Receiving a reply re-extracts the supplier's documents with the model.
export const maxDuration = 300;

export default async function QuotesPage({ searchParams }: PageProps<"/quotes">) {
  const { supplier } = await searchParams;
  const client = db();
  const { rail, detail } = await loadQuotes(client, typeof supplier === "string" ? supplier.toUpperCase() : null);
  const documents = detail
    ? await Promise.all(detail.documents.map(async (d) => ({ id: d.id, file_name: d.file_name, mime_type: d.mime_type, model: await renderDocument(client, d) })))
    : [];

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <SupplierRail rail={rail} selected={detail?.supplier.code ?? null} />
      <div className="min-w-0 flex-1">
        {detail ? (
          <QuotesWorkspace key={detail.supplier.code} detail={detail} documents={documents} />
        ) : (
          <p className="text-sm text-zinc-600">No supplier responses yet.</p>
        )}
      </div>
    </div>
  );
}
