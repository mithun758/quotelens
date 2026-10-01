// Freshness as a small rubber stamp: Fresh, Reconfirm or Stale.
const TONE: Record<string, string> = { Fresh: "text-ledger", Reconfirm: "text-pencil", Stale: "text-oxblood" };

export function Stamp({ status, title }: { status: string | null | undefined; title?: string }) {
  if (!status) return null;
  return (
    <span className={`stamp ${TONE[status] ?? "text-slate"}`} title={title}>
      {status}
    </span>
  );
}
