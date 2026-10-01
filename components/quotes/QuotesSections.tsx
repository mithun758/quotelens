import Link from "next/link";
import { extractionSummary } from "@/lib/quotes/extraction";
import { formatLabel, type SupplierDetail } from "@/lib/quotes/load";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { SectionHeader } from "../ui/ScreenHeader";
import { Stamp } from "../ui/Stamp";
import { AddResponse } from "./AddResponse";
import { FormatIcon } from "./FormatIcon";
import { displayDate } from "./format";

const STATUS: Record<string, string> = { received: "Not read yet", processing: "Reading", extracted: "Read", failed: "Extraction failed" };

const passed = (d: SupplierDetail) => d.questionnaire.filter((q) => q.pass_fail === "pass").length;

// One card per supplier response; the selected supplier carries a 2px ink bar.
export function InboxSection({
  details,
  selected,
  freshness,
  totalLines,
  questionCount,
}: {
  details: SupplierDetail[];
  selected: string | null;
  freshness: Record<string, string | null>;
  totalLines: number;
  questionCount: number;
}) {
  return (
    <section id="inbox" aria-labelledby="inbox-title" className="scroll-mt-20 space-y-3">
      <SectionHeader id="inbox-title" title="Supplier inbox" description={`${details.length} responses to the RFx, as they arrived. Email is simulated; the files are the real inputs.`} />
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
        {details.map((d) => {
          const read = d.response?.status === "extracted";
          const x = read ? extractionSummary(d, totalLines) : null;
          const active = d.supplier.code === selected;
          const docs = d.documents.slice(0, 2);
          const status = freshness[d.supplier.code];
          return (
            <li key={d.supplier.id} className={cn("relative flex min-w-0 flex-col gap-3 rounded-xs border border-rule bg-sheet p-4", active && "border-t-ink shadow-[inset_0_1px_0_var(--ink)]")}>
              <div className="min-w-0">
                <Link
                  href={`/quotes?supplier=${d.supplier.code}#exceptions`}
                  aria-current={active ? "true" : undefined}
                  className="text-body font-semibold underline decoration-rule underline-offset-4 after:absolute after:inset-0 hover:decoration-ink"
                >
                  <span className="text-slate">{d.supplier.code}</span> {d.supplier.name}
                </Link>
                <p className="text-meta text-slate">
                  {d.supplier.is_incumbent ? "Incumbent. " : ""}
                  {d.response ? `Received ${displayDate(d.response.received_at)}` : "No response"}
                </p>
              </div>
              <ul className="space-y-1 text-meta">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex min-w-0 items-center gap-1.5" title={doc.file_name}>
                    <FormatIcon format={formatLabel(doc.mime_type)} />
                    <span className="truncate text-slate">{doc.file_name}</span>
                  </li>
                ))}
                {d.documents.length > docs.length && <li className="text-slate">and {d.documents.length - docs.length} more</li>}
              </ul>
              <div className="mt-auto space-y-2">
                {x ? (
                  <div className="space-y-1">
                    <Progress value={(x.mapped / totalLines) * 100} aria-label={`${x.mapped} of ${totalLines} lines`} />
                    <p className="text-meta text-slate">
                      {x.mapped} of {totalLines} lines
                    </p>
                  </div>
                ) : (
                  <p className="text-meta text-slate">{d.response ? (STATUS[d.response.status] ?? d.response.status) : "Waiting for a response"}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {status && <Stamp status={status} />}
                  {read && (
                    <Badge variant={passed(d) === questionCount ? "ledger" : "oxblood"}>
                      Questionnaire {passed(d)}/{questionCount}
                    </Badge>
                  )}
                  {d.awaiting > 0 ? <Badge variant="ink">Awaiting reply</Badge> : d.queueCount > 0 ? <Badge variant="pencil">{d.queueCount} to review</Badge> : null}
                </div>
              </div>
            </li>
          );
        })}
        <AddResponse suppliers={details.map((d) => ({ code: d.supplier.code, name: d.supplier.name }))} />
      </ol>
    </section>
  );
}

export function ExtractionSection({ details, totalLines, extractedAt, children }: { details: SupplierDetail[]; totalLines: number; extractedAt: Record<string, string | null>; children?: React.ReactNode }) {
  const th = "border-b-2 border-rule-strong px-3 py-2 text-meta font-semibold text-slate";
  const cell = "h-9 border-b border-rule px-3";
  const none = <span className="text-slate">None</span>;
  return (
    <section id="extraction" aria-labelledby="extraction-title" className="scroll-mt-20 space-y-3">
      <SectionHeader id="extraction-title" title="Extraction" description={`Claude reads each document and maps priced items to the ${totalLines} RFx lines; code normalises the prices.`} />
      {children}
      <div className="overflow-x-auto rounded-xs border border-rule bg-sheet">
        <table className="w-full min-w-[40rem] border-collapse text-table">
          <thead>
            <tr>
              <th className={`${th} text-left`}>Supplier</th>
              <th className={`${th} text-right`}>Lines found</th>
              <th className={`${th} text-right`}>Mapped</th>
              <th className={`${th} text-right`}>To review</th>
              <th className={`${th} text-right`}>Missing</th>
              <th className={`${th} text-right`}>Unmatched</th>
              <th className={`${th} text-right`}>Extracted at</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d) => {
              const read = d.response?.status === "extracted";
              const x = read ? extractionSummary(d, totalLines) : null;
              return (
                <tr key={d.supplier.id} className="hover:bg-tint">
                  <td className={cell}>
                    <Link href={`/quotes?supplier=${d.supplier.code}#exceptions`} className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                      <span className="text-slate">{d.supplier.code}</span> {d.supplier.name}
                    </Link>
                  </td>
                  {x ? (
                    <>
                      <td className={`${cell} text-right`}>{x.found}</td>
                      <td className={`${cell} text-right`}>
                        {x.mapped} <span className="text-slate">of {totalLines}</span>
                      </td>
                      <td className={`${cell} text-right ${x.needsReview ? "font-semibold text-pencil" : ""}`}>{x.needsReview || none}</td>
                      <td className={`${cell} text-right ${x.missing ? "text-oxblood" : ""}`}>{x.missing || none}</td>
                      <td className={`${cell} text-right ${x.unmatched ? "text-pencil" : ""}`}>{x.unmatched || none}</td>
                      <td className={`${cell} text-right text-slate`}>{extractedAt[d.supplier.code] ?? "Read"}</td>
                    </>
                  ) : (
                    <td colSpan={6} className={`${cell} text-right text-slate`}>
                      {d.response ? (STATUS[d.response.status] ?? d.response.status) : "No response"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SupplierTabs({ details, selected }: { details: SupplierDetail[]; selected: string | null }) {
  return (
    <nav aria-label="Supplier" className="flex flex-wrap gap-x-6 border-b border-rule">
      {details.map((d) => {
        const active = d.supplier.code === selected;
        return (
          <Link
            key={d.supplier.id}
            href={`/quotes?supplier=${d.supplier.code}#exceptions`}
            aria-current={active ? "page" : undefined}
            className={cn("-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 text-body whitespace-nowrap", active ? "border-ink font-semibold" : "border-transparent text-slate hover:text-ink")}
          >
            <span className={active ? "text-slate" : ""}>{d.supplier.code}</span> {d.supplier.name}
            {d.awaiting > 0 ? <Badge variant="ink">Awaiting</Badge> : d.queueCount > 0 ? <Badge variant="pencil">{d.queueCount}</Badge> : null}
          </Link>
        );
      })}
    </nav>
  );
}
