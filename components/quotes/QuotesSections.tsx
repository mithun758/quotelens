import Link from "next/link";
import { extractionSummary } from "@/lib/quotes/extraction";
import { formatLabel, type SupplierDetail } from "@/lib/quotes/load";
import { AddResponse } from "./AddResponse";
import { FormatIcon } from "./FormatIcon";
import { displayDate } from "./format";

const STATUS: Record<string, string> = { received: "Received, not read", processing: "Reading", extracted: "Read", failed: "Extraction failed" };

export function InboxSection({ details }: { details: SupplierDetail[] }) {
  return (
    <section id="inbox" aria-labelledby="inbox-title" className="scroll-mt-20">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-1">
        <div>
          <h2 id="inbox-title" className="text-base font-semibold">
            Supplier inbox
          </h2>
          <p className="text-xs text-slate">{details.length} responses to the RFx, as they arrived. Email is simulated; the files are the real inputs.</p>
        </div>
        <AddResponse suppliers={details.map((d) => ({ code: d.supplier.code, name: d.supplier.name }))} />
      </div>
      <ol className="grid border-b border-rule" style={{ gridTemplateColumns: `repeat(${Math.max(details.length, 1)}, minmax(0, 1fr))` }}>
        {details.map((d) => (
          <li key={d.supplier.id} className="min-w-0 border-r border-rule px-3 py-3 last:border-r-0">
            <Link href={`/quotes?supplier=${d.supplier.code}#exceptions`} className="text-[13px] font-semibold leading-4 underline decoration-rule underline-offset-4 hover:decoration-ink">
              {d.supplier.code}. {d.supplier.name}
            </Link>
            {d.supplier.is_incumbent && <span className="block text-xs text-slate">Incumbent</span>}
            <dl className="mt-2 text-xs">
              <dt className="text-slate">Received</dt>
              <dd>{d.response ? displayDate(d.response.received_at) : "No response"}</dd>
            </dl>
            <ul className="mt-2 space-y-1 text-xs">
              {d.documents.map((doc) => (
                <li key={doc.id} className="flex min-w-0 items-center gap-1" title={doc.file_name}>
                  <span className="shrink-0">
                    <FormatIcon format={formatLabel(doc.mime_type)} />
                  </span>
                  <span className="truncate text-slate">{doc.file_name}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ExtractionSection({ details, totalLines, children }: { details: SupplierDetail[]; totalLines: number; children?: React.ReactNode }) {
  const th = "border-b border-rule py-1.5 pr-3 text-xs font-semibold text-slate";
  return (
    <section id="extraction" aria-labelledby="extraction-title" className="scroll-mt-20 space-y-3">
      <div className="border-b border-ink pb-1">
        <h2 id="extraction-title" className="text-base font-semibold">
          Extraction and mapping
        </h2>
        <p className="text-xs text-slate">Claude reads each document and maps priced items to the {totalLines} RFx lines; code normalises the prices.</p>
      </div>
      {children}
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${th} text-left`}>Supplier</th>
            <th className={`${th} text-left`}>Status</th>
            <th className={`${th} text-right`}>Items found</th>
            <th className={`${th} text-right`}>Unmatched</th>
            <th className={`${th} text-right`}>Mapped to RFx lines</th>
            <th className={`${th} w-[9rem] text-left`}>
              <span className="sr-only">Coverage</span>
            </th>
            <th className={`${th} text-right`}>Needs review</th>
            <th className={`${th} text-right`}>Missing lines</th>
          </tr>
        </thead>
        <tbody>
          {details.map((d) => {
            const read = d.response?.status === "extracted";
            const x = read ? extractionSummary(d, totalLines) : null;
            const cell = "h-9 border-b border-rule pr-3";
            return (
              <tr key={d.supplier.id}>
                <td className={cell}>
                  <Link href={`/quotes?supplier=${d.supplier.code}#exceptions`} className="font-semibold underline decoration-rule underline-offset-4 hover:decoration-ink">
                    {d.supplier.code}. {d.supplier.name}
                  </Link>
                </td>
                <td className={`${cell} ${read ? "text-ledger" : "text-slate"}`}>{d.response ? STATUS[d.response.status] ?? d.response.status : "No response"}</td>
                <td className={`${cell} text-right`}>{x?.found ?? ""}</td>
                <td className={`${cell} text-right ${x?.unmatched ? "text-pencil" : ""}`}>{x ? x.unmatched || "None" : ""}</td>
                <td className={`${cell} text-right`}>{x ? `${x.mapped} of ${totalLines}` : ""}</td>
                <td className={cell}>
                  {x && (
                    <span aria-hidden className="block h-[3px] w-full bg-rule">
                      <span className="block h-full bg-ink" style={{ width: `${(x.mapped / totalLines) * 100}%` }} />
                    </span>
                  )}
                </td>
                <td className={`${cell} text-right ${x?.needsReview ? "font-semibold text-pencil" : ""}`}>{x ? x.needsReview || "None" : ""}</td>
                <td className={`${cell} text-right ${x?.missing ? "text-oxblood" : ""}`}>{x ? x.missing || "None" : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function SupplierTabs({ details, selected }: { details: SupplierDetail[]; selected: string | null }) {
  return (
    <nav aria-label="Supplier" className="flex gap-5 border-b border-rule">
      {details.map((d) => {
        const active = d.supplier.code === selected;
        return (
          <Link
            key={d.supplier.id}
            href={`/quotes?supplier=${d.supplier.code}#exceptions`}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2 text-sm ${active ? "border-ink font-semibold" : "border-transparent text-slate hover:text-ink"}`}
          >
            {d.supplier.code}. {d.supplier.name}
            {d.awaiting > 0 ? <span className="ml-1.5 text-xs font-semibold text-ink">awaiting</span> : d.queueCount > 0 ? <span className="ml-1.5 rounded-xs bg-amber-tint px-1 text-xs font-semibold text-pencil">{d.queueCount}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
