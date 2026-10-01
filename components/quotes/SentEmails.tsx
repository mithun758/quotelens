"use client";

import type { ClarificationRow } from "@/lib/db/types";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// The stubbed outbox: each clarification email as "sent", and the supplier's reply once received.
export function SentEmails({ clarifications, supplierName }: { clarifications: ClarificationRow[]; supplierName: string }) {
  // One email can cover several items; they share a flag.
  const emails = [...new Map(clarifications.map((c) => [c.flag_id, c])).values()].sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  if (!emails.length) return null;
  const itemCount = (flagId: string) => clarifications.filter((c) => c.flag_id === flagId).length;

  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-3 py-2">
        <h3 className="text-sm font-semibold">Clarifications</h3>
        <p className="text-xs text-zinc-500">Email sending is simulated in this prototype; replies are seeded and read by the real extraction model.</p>
      </div>
      <ul className="divide-y divide-zinc-100">
        {emails.map((e) => (
          <li key={e.flag_id} className="space-y-2 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{e.subject ?? "Clarification"}</span>
              <span className={`rounded px-1.5 py-0.5 text-xs ${e.status === "awaiting" ? "bg-sky-100 text-sky-900" : "bg-emerald-100 text-emerald-900"}`}>
                {e.status === "awaiting" ? "Awaiting supplier" : "Answered"}
              </span>
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-50 p-2 text-xs">
              <p className="text-zinc-500">
                To: {supplierName} · Sent {when(e.sent_at)} IST (simulated) · covers {itemCount(e.flag_id)} item{itemCount(e.flag_id) === 1 ? "" : "s"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-800">{e.question}</p>
            </div>
            {e.reply_text && (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs">
                <p className="text-emerald-900">Reply received {when(e.answered_at)} IST, re-extracted with its attachments</p>
                <p className="mt-1 whitespace-pre-wrap text-zinc-800">{e.reply_text}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
