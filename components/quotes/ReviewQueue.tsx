"use client";

import { useState, useTransition } from "react";
import { acceptAction, correctAction, draftAction, receiveReplyAction, sendAction } from "@/app/(app)/quotes/actions";
import type { QueueItem } from "@/lib/review/queue";
import { CONFIDENCE_LABEL, CONFIDENCE_STYLE } from "./format";

const SEVERITY_STYLE = { high: "text-red-700", medium: "text-amber-800", low: "text-zinc-600" } as const;

function CorrectForm({ onSubmit, onCancel, pending }: { onSubmit: (value: number, reason: string) => void; onCancel: () => void; pending: boolean }) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="mt-2 space-y-2 rounded border border-zinc-200 bg-zinc-50 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Number(value.replace(/,/g, "")), reason);
      }}
    >
      <label className="block text-xs">
        Correct price (INR per piece, ex-GST, delivered)
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" required className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm" />
      </label>
      <label className="block text-xs">
        Reason (logged)
        <input value={reason} onChange={(e) => setReason(e.target.value)} required className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-60">
          Save correction
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-zinc-300 px-2 py-1 text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ReviewQueue({
  supplierCode,
  supplierName,
  items,
  awaiting,
  onFocus,
}: {
  supplierCode: string;
  supplierName: string;
  items: QueueItem[];
  awaiting: number;
  onFocus: (item: QueueItem) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong");
      else if (done) setNotice(done);
    });

  const askable = items.filter((i) => i.actions.includes("ask") && i.clarification?.status !== "awaiting");

  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold">{items.length === 0 ? "Nothing needs you" : `${items.length} item${items.length === 1 ? "" : "s"} need you`}</h3>
          <p className="text-xs text-zinc-500">Only Inferred, Missing and flagged items appear here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await draftAction(supplierCode, selected);
                  if (result.ok && result.data) setDraft(result.data);
                  else if (!result.ok) setError(result.error);
                })
              }
              className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-60"
            >
              {pending && !draft ? "Drafting..." : `Ask supplier about ${selected.length}`}
            </button>
          )}
          {awaiting > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => receiveReplyAction(supplierCode), "Supplier reply received and re-extracted by the model.")}
              className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-900 disabled:opacity-60"
            >
              {pending ? "Reading the reply..." : "Simulate supplier reply"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {notice && <p className="border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      {draft && (
        <div className="space-y-2 border-b border-zinc-200 bg-sky-50 p-3">
          <p className="text-xs font-medium text-sky-900">Draft to {supplierName}. Edit before sending. Email sending is simulated.</p>
          <input
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
            aria-label="Subject"
          />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={10}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
            aria-label="Message"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const r = await sendAction(supplierCode, selected, draft.subject, draft.body);
                  if (r.ok) {
                    setDraft(null);
                    setSelected([]);
                  }
                  return r;
                }, "Sent (simulated). These items now show Awaiting supplier.")
              }
              className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-60"
            >
              Send to supplier
            </button>
            <button type="button" onClick={() => setDraft(null)} className="rounded border border-zinc-300 px-2 py-1 text-xs">
              Discard
            </button>
          </div>
        </div>
      )}

      <ul className="max-h-[60vh] divide-y divide-zinc-100 overflow-auto">
        {items.map((item) => {
          const canAsk = askable.includes(item);
          return (
            <li key={item.key} className="px-3 py-2 text-sm">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.headline} to ask the supplier`}
                  disabled={!canAsk}
                  checked={selected.includes(item.key)}
                  onChange={(e) => setSelected(e.target.checked ? [...selected, item.key] : selected.filter((k) => k !== item.key))}
                  className="mt-1"
                />
                <button type="button" onClick={() => onFocus(item)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.confidence && <span className={`rounded px-1.5 py-0.5 text-xs ${CONFIDENCE_STYLE[item.confidence]}`}>{CONFIDENCE_LABEL[item.confidence]}</span>}
                    <span className="font-medium">{item.headline}</span>
                  </div>
                  {item.detail && <p className="mt-0.5 whitespace-pre-line text-xs text-zinc-600">{item.detail}</p>}
                  {item.flags
                    .filter((f) => f.message !== item.detail)
                    .map((f) => (
                      <p key={f.id} className={`mt-0.5 text-xs ${SEVERITY_STYLE[f.severity]}`}>
                        {f.message}
                      </p>
                    ))}
                  {item.clarification?.status === "awaiting" && <p className="mt-1 text-xs font-medium text-sky-800">Awaiting supplier</p>}
                  {item.clarification?.status === "answered" && (
                    <p className="mt-1 text-xs text-sky-900">Supplier replied. Reply re-extracted; check the value before accepting.</p>
                  )}
                </button>
              </div>
              <div className="ml-6 mt-1 flex gap-2">
                {item.actions.includes("accept") && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => acceptAction(supplierCode, item.key))}
                    className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 disabled:opacity-60"
                  >
                    {item.confidence === "missing" ? "Accept as not quoted" : "Accept"}
                  </button>
                )}
                {item.actions.includes("correct") && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setCorrecting(correcting === item.key ? null : item.key)}
                    className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 disabled:opacity-60"
                  >
                    Correct
                  </button>
                )}
              </div>
              {correcting === item.key && (
                <div className="ml-6">
                  <CorrectForm
                    pending={pending}
                    onCancel={() => setCorrecting(null)}
                    onSubmit={(value, reason) =>
                      run(async () => {
                        const r = await correctAction(supplierCode, item.key, value, reason);
                        if (r.ok) setCorrecting(null);
                        return r;
                      })
                    }
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
