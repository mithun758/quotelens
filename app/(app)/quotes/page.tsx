import { ExtractPanel } from "@/components/quotes/ExtractPanel";
import { ExtractionSection, InboxSection, SupplierTabs } from "@/components/quotes/QuotesSections";
import { QuotesWorkspace } from "@/components/quotes/QuotesWorkspace";
import { ScreenHeader, SectionHeader } from "@/components/ui/ScreenHeader";
import { db } from "@/lib/db/client";
import { renderDocument } from "@/lib/documents/render";
import { loadFreshness } from "@/lib/freshness/load";
import { loadAllDetails } from "@/lib/quotes/load";

export const metadata = { title: "Quotes · QuoteLens" };
export const dynamic = "force-dynamic";
// Receiving a reply re-extracts the supplier's documents with the model.
export const maxDuration = 300;

// "1 Oct, 16:13" in IST, for when a quote was last read.
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function QuotesPage({ searchParams }: PageProps<"/quotes">) {
  const { supplier, doc, loc } = await searchParams;
  const client = db();
  const [{ rfx, lines, details }, freshness, runs] = await Promise.all([
    loadAllDetails(client),
    loadFreshness(client),
    client.from("extraction_run").select("scope, finished_at, status").not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(50),
  ]);
  const code = typeof supplier === "string" ? supplier.toUpperCase() : null;
  // A Lens citation ([[doc:id:locator]]) opens the supplier that owns the document.
  const citedDoc = typeof doc === "string" ? doc : null;
  const owner = citedDoc ? details.find((d) => d.documents.some((x) => x.id === citedDoc)) : undefined;
  const detail = owner ?? details.find((d) => d.supplier.code === code) ?? details[0] ?? null;
  const cited = owner && citedDoc ? { documentId: citedDoc, locator: typeof loc === "string" ? loc : "" } : null;
  const documents = detail
    ? await Promise.all(detail.documents.map(async (d) => ({ id: d.id, file_name: d.file_name, mime_type: d.mime_type, model: await renderDocument(client, d) })))
    : [];
  const notExtracted = details.filter((d) => d.response && d.response.status !== "extracted").map((d) => ({ code: d.supplier.code, name: d.supplier.name, documents: d.documents.length }));
  const extracted = detail?.response?.status === "extracted";
  const stamps = Object.fromEntries(details.map((d) => [d.supplier.code, freshness[d.supplier.code]?.status ?? null]));
  // The latest finished run that covered each supplier.
  const extractedAt = Object.fromEntries(
    details.map((d) => {
      const run = (runs.data ?? []).find((r) => r.scope === "all" || r.scope.split(",").includes(d.supplier.code));
      return [d.supplier.code, run?.finished_at ? when(run.finished_at) : null];
    }),
  );
  // Where to go once this supplier's queue is empty.
  const next = details.find((d) => d.supplier.code !== detail?.supplier.code && d.queueCount > 0);

  return (
    <div className="space-y-8">
      <ScreenHeader title="Quotes" description="From inbox to a reviewed quote: read every response, map it to the RFx, and clear the exceptions." />
      <InboxSection details={details} selected={detail?.supplier.code ?? null} freshness={stamps} totalLines={lines.length} questionCount={rfx.questionnaire.length} />
      <ExtractionSection details={details} totalLines={lines.length} extractedAt={extractedAt}>
        {notExtracted.length > 0 && <ExtractPanel key={notExtracted.map((p) => p.code).join()} pending={notExtracted} />}
      </ExtractionSection>
      <section id="exceptions" aria-labelledby="exceptions-title" className="scroll-mt-20 space-y-4">
        <SectionHeader id="exceptions-title" title="Exception review" description="Only Inferred, Missing and flagged items need you. Everything else was read directly from the source." />
        <SupplierTabs details={details} selected={detail?.supplier.code ?? null} />
        {detail ? (
          extracted ? (
            <QuotesWorkspace
              key={`${detail.supplier.code}-${cited?.documentId ?? ""}-${cited?.locator ?? ""}`}
              detail={detail}
              documents={documents}
              freshness={freshness[detail.supplier.code]?.status ?? null}
              cited={cited}
              next={next ? { code: next.supplier.code, name: next.supplier.name, count: next.queueCount } : null}
            />
          ) : (
            <p className="text-body text-slate">This quote has not been read yet. Extract the quotes above first; it takes about a minute.</p>
          )
        ) : (
          <p className="text-body text-slate">No supplier responses yet. Send the RFx from step 1 and responses will appear here.</p>
        )}
      </section>
    </div>
  );
}
