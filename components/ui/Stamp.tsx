import { cn } from "@/lib/utils";

// Freshness as a rubber stamp: Fresh in ledger, Reconfirm in amber with pencil text,
// Stale in oxblood. Sentence case, no fill, no rotation. With onClick it is a button
// that opens the rules that fired.
const TONE: Record<string, string> = {
  Fresh: "text-ledger",
  Reconfirm: "text-pencil [--stamp-line:var(--amber)]",
  Stale: "text-oxblood",
};

export function Stamp({ status, title, onClick, className }: { status: string | null | undefined; title?: string; onClick?: () => void; className?: string }) {
  if (!status) return null;
  const cls = cn("stamp", TONE[status] ?? "text-slate", className);
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} aria-label={`${status}: show the Quote Freshness rules`} className={cn(cls, "cursor-pointer hover:bg-tint")}>
        {status}
      </button>
    );
  }
  return (
    <span className={cls} title={title}>
      {status}
    </span>
  );
}
