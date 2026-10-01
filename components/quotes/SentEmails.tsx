"use client";

import type { ClarificationRow } from "@/lib/db/types";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// The stubbed outbox: each question as sent, and the supplier's reply once received.
export function SentEmails({ clarifications, supplierName }: { clarifications: ClarificationRow[]; supplierName: string }) {
  // One email can cover several items; they share a flag.
  const emails = [...new Map(clarifications.map((c) => [c.flag_id, c])).values()].sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  if (!emails.length) return null;
  const itemCount = (flagId: string) => clarifications.filter((c) => c.flag_id === flagId).length;

  return (
    <section aria-label="Questions to the supplier">
      <div className="border-b border-ink pb-1">
        <h2 className="text-base font-semibold">Questions to {supplierName}</h2>
        <p className="text-xs text-slate">Sending is simulated; replies are read by the real model.</p>
      </div>
      <ul>
        {emails.map((e) => (
          <li key={e.flag_id} className="space-y-2 border-b border-rule py-3 text-[13px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{e.subject ?? "Question"}</span>
              <span className={`text-xs font-semibold ${e.status === "awaiting" ? "" : "text-ledger"}`}>{e.status === "awaiting" ? "Awaiting reply" : "Answered"}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 text-xs">
              <div>
                <dt className="inline text-slate">Sent </dt>
                <dd className="inline">{when(e.sent_at)} IST</dd>
              </div>
              <div>
                <dt className="inline text-slate">Covers </dt>
                <dd className="inline">
                  {itemCount(e.flag_id)} item{itemCount(e.flag_id) === 1 ? "" : "s"}
                </dd>
              </div>
            </dl>
            <p className="whitespace-pre-wrap border-l-[3px] border-rule pl-3 text-xs">{e.question}</p>
            {e.reply_text && (
              <div className="border-l-[3px] border-ledger pl-3 text-xs">
                <p className="font-semibold text-ledger">Reply, {when(e.answered_at)} IST, read with its attachments</p>
                <p className="mt-1 whitespace-pre-wrap">{e.reply_text}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
