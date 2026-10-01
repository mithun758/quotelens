import Link from "next/link";
import { countOpenBlockers } from "@/lib/blockers/count";
import { RFX_TITLE, asOfDate, formatDisplayDate } from "@/lib/config";
import { db } from "@/lib/db/client";
import { ResetDemoButton } from "./ResetDemoButton";

// /eval is deliberately not linked: it is a hidden page.
const NAV = [
  { href: "/rfx", label: "RFx" },
  { href: "/quotes", label: "Quotes" },
  { href: "/comparison", label: "Comparison" },
  { href: "/award", label: "Award" },
] as const;

export async function Header() {
  const openBlockers = await countOpenBlockers(db()).catch(() => null);

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">QuoteLens</p>
          <h1 className="text-base font-semibold">{RFX_TITLE}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-600">
            As of <span className="font-medium text-zinc-900">{formatDisplayDate(asOfDate())}</span>
          </span>
          <span
            className={`rounded-full border px-3 py-1 ${openBlockers ? "border-amber-300 bg-amber-50 text-amber-900" : "border-zinc-300 text-zinc-700"}`}
            title="Inferred values not yet accepted or corrected, plus open flags and clarifications"
          >
            Open blockers: <span className="font-semibold">{openBlockers ?? "–"}</span>
          </span>
          <ResetDemoButton />
        </div>
      </div>
      <nav className="flex gap-1 px-4">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-t-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
