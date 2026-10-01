import Link from "next/link";
import type { SupplierSummary } from "@/lib/quotes/load";
import { FormatIcon } from "./FormatIcon";

export function SupplierRail({ rail, selected, totalLines }: { rail: SupplierSummary[]; selected: string | null; totalLines: number }) {
  return (
    <nav aria-label="Supplier responses" className="w-[13.5rem] shrink-0">
      <h2 className="pb-2 text-xs font-semibold text-slate">Supplier responses</h2>
      <ul className="border-y border-rule">
        {rail.map(({ supplier, response, formats, queueCount, awaiting }) => {
          const active = supplier.code === selected;
          const extracted = response?.status === "extracted";
          const coverage = response?.coverage_count ?? null;
          return (
            <li key={supplier.id} className="border-b border-rule last:border-b-0">
              <Link href={`/quotes?supplier=${supplier.code}`} aria-current={active ? "page" : undefined} className={`relative block px-3 py-2.5 hover:bg-tint ${active ? "bg-tint" : ""}`}>
                {active && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-ink" />}
                <span className="block text-[13px] font-semibold leading-4">
                  {supplier.code}. {supplier.name}
                </span>
                {supplier.is_incumbent && <span className="block text-xs text-slate">Incumbent</span>}
                <span className="mt-1 flex flex-wrap gap-x-2 text-xs">
                  {formats.map((f) => (
                    <FormatIcon key={f} format={f} />
                  ))}
                </span>
                {extracted && coverage !== null ? (
                  <>
                    <span aria-hidden className="mt-2 block h-[3px] w-full bg-rule">
                      <span className="block h-full bg-ink" style={{ width: `${(coverage / totalLines) * 100}%` }} />
                    </span>
                    <span className="mt-1 flex justify-between text-xs">
                      <span>
                        {coverage} of {totalLines} lines
                      </span>
                      {awaiting > 0 ? <span className="font-semibold">Awaiting reply</span> : queueCount > 0 ? <span className="text-pencil">{queueCount} to review</span> : <span className="text-ledger">Reviewed</span>}
                    </span>
                  </>
                ) : (
                  <span className="mt-1 block text-xs text-slate">{response?.status === "failed" ? "Extraction failed" : response ? "Received, not extracted" : "No response"}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
