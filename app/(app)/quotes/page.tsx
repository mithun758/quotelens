import { ExtractPanel } from "@/components/quotes/ExtractPanel";
import { ExtractionSection, InboxSection, SupplierTabs } from "@/components/quotes/QuotesSections";
import { QuotesWorkspace } from "@/components/quotes/QuotesWorkspace";
import { db } from "@/lib/db/client";
import { renderDocument } from "@/lib/documents/render";
import { loadFreshness } from "@/lib/freshness/load";
import { loadAllDetails } from "@/lib/quotes/load";

export const metadata = { title: "Quotes · QuoteLens" };
export const dynamic = "force-dynamic";
// Receiving a reply re-extracts the supplier's documents with the model.
export const maxDuration = 300;

export default async function QuotesPage({ searchParams }: PageProps<"/quotes">) {
  const { supplier } = await searchParams;
  const client = db();
  const [{ lines, details }, freshness] = await Promise.all([loadAllDetails(client), loadFreshness(client)]);
  const code = typeof supplier === "string" ? supplier.toUpperCase() : null;
  const detail = details.find((d) => d.supplier.code === code) ?? details[0] ?? null;
  const documents = detail
    ? await Promise.all(detail.documents.map(async (d) => ({ id: d.id, file_name: d.file_name, mime_type: d.mime_type, model: await renderDocument(client, d) })))
    : [];
  const notExtracted = details.filter((d) => d.response && d.response.status !== "extracted").map((d) => ({ code: d.supplier.code, name: d.supplier.name }));
  const extracted = detail?.response?.status === "extracted";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Quotes</h1>
        <p className="text-sm text-slate">From inbox to a reviewed quote: read every response, map it to the RFx, and clear the exceptions.</p>
      </div>
      <InboxSection details={details} />
      <ExtractionSection details={details} totalLines={lines.length}>
        {notExtracted.length > 0 && <ExtractPanel key={notExtracted.map((p) => p.code).join()} pending={notExtracted} />}
      </ExtractionSection>
      <section id="exceptions" aria-labelledby="exceptions-title" className="scroll-mt-20 space-y-4">
        <div className="border-b border-ink pb-1">
          <h2 id="exceptions-title" className="text-base font-semibold">
            Exception review
          </h2>
          <p className="text-xs text-slate">Only Inferred, Missing and flagged items need you. Everything else was read directly from the source.</p>
        </div>
        <SupplierTabs details={details} selected={detail?.supplier.code ?? null} />
        {detail ? (
          extracted ? (
            <QuotesWorkspace key={detail.supplier.code} detail={detail} documents={documents} freshness={freshness[detail.supplier.code]?.status ?? null} />
          ) : (
            <p className="text-sm text-slate">This quote has not been read yet. Extract the quotes above first; it takes about a minute.</p>
          )
        ) : (
          <p className="text-sm text-slate">No supplier responses yet. Send the RFx from step 1 and responses will appear here.</p>
        )}
      </section>
    </div>
  );
}
