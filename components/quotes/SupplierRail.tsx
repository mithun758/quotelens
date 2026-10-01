import Link from "next/link";
import type { SupplierSummary } from "@/lib/quotes/load";

const STATUS: Record<string, string> = {
  received: "Received",
  processing: "Extracting",
  extracted: "Extracted",
  failed: "Extraction failed",
};

export function SupplierRail({ rail, selected }: { rail: SupplierSummary[]; selected: string | null }) {
  return (
    <nav aria-label="Supplier responses" className="w-full shrink-0 space-y-2 lg:w-64">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Supplier emails</h2>
      {rail.map(({ supplier, response, formats, queueCount, awaiting }) => {
        const active = supplier.code === selected;
        return (
          <Link
            key={supplier.id}
            href={`/quotes?supplier=${supplier.code}`}
            className={`block rounded-md border px-3 py-2 text-sm ${active ? "border-zinc-900 bg-white shadow-sm" : "border-zinc-200 bg-white hover:border-zinc-400"}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">
                {supplier.code}. {supplier.name}
              </span>
              {supplier.is_incumbent && <span className="text-[10px] uppercase text-zinc-500">Incumbent</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600">
              <span>{formats.join(" + ")}</span>
              <span>·</span>
              <span>{response ? STATUS[response.status] ?? response.status : "No response"}</span>
              {response?.coverage_count !== null && response?.coverage_count !== undefined && (
                <>
                  <span>·</span>
                  <span className="font-medium text-zinc-800">{response.coverage_count}/30 lines</span>
                </>
              )}
            </div>
            <div className="mt-1 flex gap-2 text-xs">
              {queueCount > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">{queueCount} need you</span>}
              {awaiting > 0 && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-900">Awaiting supplier</span>}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
