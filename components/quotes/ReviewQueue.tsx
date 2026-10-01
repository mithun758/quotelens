"use client";

import { useMemo, useState, useTransition } from "react";
import { acceptAction, correctAction, draftAction, receiveReplyAction, sendAction } from "@/app/(app)/quotes/actions";
import type { ValueWithLine } from "@/lib/quotes/load";
import { groupQueue } from "@/lib/review/groups";
import type { QueueItem } from "@/lib/review/queue";
import { ErrorNote } from "../ErrorNote";
import { btn, input } from "../ui/styles";
import { Value } from "../ui/Value";
import { inr } from "./format";

const SEVERITY = { high: "text-oxblood", medium: "text-pencil", low: "text-slate" } as const;

function CorrectForm({ onSubmit, onCancel, pending }: { onSubmit: (value: number, reason: string) => void; onCancel: () => void; pending: boolean }) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="mt-2 grid grid-cols-[8rem_1fr] gap-2 border-l-[3px] border-ink bg-paper p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Number(value.replace(/,/g, "")), reason);
      }}
    >
      <label className="text-xs text-slate">
        Correct price (₹ per piece)
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" required className={`${input} mt-1 w-full`} />
      </label>
      <label className="text-xs text-slate">
        Reason, logged
        <input value={reason} onChange={(e) => setReason(e.target.value)} required className={`${input} mt-1 w-full`} />
      </label>
      <div className="col-span-2 flex gap-2">
        <button type="submit" disabled={pending} className={btn.smallPrimary}>
          Save correction
        </button>
        <button type="button" onClick={onCancel} className={btn.small}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const acceptLabel = (item: QueueItem) => (item.kind === "response_flag" ? "Accept flag" : item.confidence === "missing" ? "Accept as not quoted" : "Accept value");

export function ReviewQueue({
  supplierCode,
  supplierName,
  items,
  values,
  awaiting,
  onFocus,
  focusedValueId,
  onAccepted,
}: {
  supplierCode: string;
  supplierName: string;
  items: QueueItem[];
  values: ValueWithLine[];
  awaiting: number;
  onFocus: (item: QueueItem) => void;
  focusedValueId: string | null;
  onAccepted: (valueIds: string[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string; keys: string[] } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  const byId = useMemo(() => new Map(values.map((v) => [v.id, v])), [values]);
  const groups = useMemo(() => groupQueue(items, new Map(values.map((v) => [v.id, v.steps.map((s) => s.kind)]))), [items, values]);
  const canAsk = (i: QueueItem) => i.actions.includes("ask") && i.clarification?.status !== "awaiting";
  const canAccept = (i: QueueItem) => i.actions.includes("accept") && i.clarification?.status !== "awaiting";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string): void =>
    startTransition(async () => {
      setRetry(() => () => run(fn, done));
      setError(null);
      setNotice(null);
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong. Try again.");
      else if (done) setNotice(done);
    });

  const accept = (item: QueueItem) =>
    run(async () => {
      const r = await acceptAction(supplierCode, item.key);
      if (r.ok && item.valueId) onAccepted([item.valueId]);
      return r;
    });

  // Accept all similar: the same accept action, once per item, so each value gets its own audit entry.
  const acceptAll = (group: QueueItem[]) => {
    const todo = group.filter(canAccept);
    run(async () => {
      const accepted: string[] = [];
      for (let i = 0; i < todo.length; i++) {
        setProgress({ done: i, total: todo.length });
        const r = await acceptAction(supplierCode, todo[i].key);
        if (!r.ok) {
          setProgress(null);
          onAccepted(accepted);
          return { ok: false, error: `${r.error ?? "Something went wrong."} ${i} of ${todo.length} were accepted; Retry continues with the rest.` };
        }
        if (todo[i].valueId) accepted.push(todo[i].valueId!);
      }
      setProgress(null);
      onAccepted(accepted);
      return { ok: true };
    }, `${todo.length} accepted. Each is logged separately.`);
  };

  const draftFor = (keys: string[]) => {
    const go = () =>
      startTransition(async () => {
        setError(null);
        setNotice(null);
        setRetry(() => go);
        const result = await draftAction(supplierCode, keys);
        if (result.ok && result.data) setDraft({ ...result.data, keys });
        else if (!result.ok) setError(result.error);
      });
    go();
  };

  return (
    <section aria-label="Review queue" className="border border-rule bg-sheet">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink px-3 py-2">
        <div>
          <h4 className="text-base font-semibold">{items.length === 0 ? "Nothing needs you" : `${items.length} to review`}</h4>
          <p className="text-xs text-slate">Only Inferred, Missing and flagged items appear here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {awaiting > 0 && (
            <button type="button" disabled={pending} onClick={() => run(() => receiveReplyAction(supplierCode), "Reply received and read by the model. Check the updated items.")} className={btn.secondary}>
              {pending && !progress ? "Reading the reply..." : "Simulate supplier reply"}
            </button>
          )}
          {selected.length > 0 && (
            <button type="button" disabled={pending} onClick={() => draftFor(selected)} className={btn.primary}>
              {pending && !draft ? "Drafting..." : `Ask supplier (${selected.length})`}
            </button>
          )}
        </div>
      </div>

      {items.length === 0 && <p className="px-3 py-4 text-sm text-slate">Every value from {supplierName} is Extracted or has been accepted. Go to Quote Comparison to compare suppliers.</p>}

      <div aria-live="polite">
        {progress && (
          <p className="border-b border-rule px-3 py-2 text-sm">
            Accepting {progress.done + 1} of {progress.total}...
          </p>
        )}
        {notice && <p className="border-b border-rule border-l-[3px] border-l-ledger bg-ledger-tint px-3 py-2 text-sm text-ledger">{notice}</p>}
      </div>
      {error && <ErrorNote message={error} busy={pending} onRetry={retry ?? undefined} />}

      {draft && (
        <div className="space-y-2 border-b border-rule bg-paper p-3">
          <p className="text-sm font-semibold">Question to {supplierName}</p>
          <p className="text-xs text-slate">Drafted by Claude from the selected items. Edit before sending; sending is simulated.</p>
          <label className="block text-xs text-slate">
            Subject
            <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className={`${input} mt-1 w-full`} />
          </label>
          <label className="block text-xs text-slate">
            Message
            <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={9} className={`${input} mt-1 w-full`} />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const r = await sendAction(supplierCode, draft.keys, draft.subject, draft.body);
                  if (r.ok) {
                    setDraft(null);
                    setSelected([]);
                  }
                  return r;
                }, "Question sent (simulated). The items now show Awaiting supplier.")
              }
              className={btn.primary}
            >
              Send question
            </button>
            <button type="button" onClick={() => setDraft(null)} className={btn.secondary}>
              Discard draft
            </button>
          </div>
        </div>
      )}

      <div className="max-h-[calc(100vh-17rem)] overflow-auto">
        {groups.map((g) => {
          const acceptable = g.items.filter(canAccept);
          return (
            <section key={g.key} aria-label={g.title} className="border-b border-rule last:border-b-0">
              <div className="flex items-start justify-between gap-2 bg-paper px-3 py-2">
                <div>
                  <h5 className="text-sm font-semibold">
                    {g.title} <span className="font-normal text-slate">{g.items.length}</span>
                  </h5>
                  <p className="text-xs text-slate">{g.note}</p>
                </div>
                {acceptable.length > 1 && (
                  <button type="button" disabled={pending} onClick={() => acceptAll(acceptable)} className={`${btn.small} shrink-0 whitespace-nowrap`}>
                    Accept all similar ({acceptable.length})
                  </button>
                )}
              </div>
              <ul>
                {g.items.map((item) => {
                  const v = item.valueId ? byId.get(item.valueId) : undefined;
                  const focused = !!item.valueId && item.valueId === focusedValueId;
                  return (
                    <li key={item.key} className={`border-t border-rule px-3 py-2 ${focused ? "bg-tint" : ""}`}>
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Include ${item.headline} in a question to the supplier`}
                          disabled={!canAsk(item)}
                          checked={selected.includes(item.key)}
                          onChange={(e) => setSelected(e.target.checked ? [...selected, item.key] : selected.filter((k) => k !== item.key))}
                          className="mt-1 accent-ink"
                        />
                        <button type="button" onClick={() => onFocus(item)} className="min-w-0 flex-1 text-left" aria-label={`${item.headline}: show the source`}>
                          <span className="flex items-baseline justify-between gap-3 text-[13px]">
                            <span className="min-w-0 truncate font-semibold">{item.headline}</span>
                            {v && item.kind === "value" && (
                              <span className="shrink-0">
                                {v.normalised_value_inr !== null ? <Value state={v.confidence_state}>{inr(v.normalised_value_inr)}</Value> : <Value state="missing" reason={v.reason} className="w-16" />}
                              </span>
                            )}
                          </span>
                          {/* The "same as last year" group note already gives the reason. */}
                          {item.detail && g.key !== "prior" && !(g.key === "missing" && /^not quoted\.?$/i.test(item.detail.trim())) && <span className="mt-0.5 block whitespace-pre-line text-xs text-slate">{item.detail}</span>}
                          {item.flags
                            .filter((f) => f.message !== item.detail)
                            .map((f) => (
                              <span key={f.id} className={`mt-0.5 block text-xs ${SEVERITY[f.severity]}`}>
                                {f.message}
                              </span>
                            ))}
                          {item.clarification?.status === "awaiting" && <span className="mt-1 block text-xs font-semibold">Awaiting supplier</span>}
                          {item.clarification?.status === "answered" && <span className="mt-1 block text-xs text-ledger">Supplier replied and the reply was read. Check the value before accepting.</span>}
                        </button>
                      </div>
                      <div className="ml-6 mt-1.5 flex flex-wrap gap-2">
                        {canAccept(item) && (
                          <button type="button" disabled={pending} onClick={() => accept(item)} className={btn.small}>
                            {acceptLabel(item)}
                          </button>
                        )}
                        {item.actions.includes("correct") && (
                          <button type="button" disabled={pending} onClick={() => setCorrecting(correcting === item.key ? null : item.key)} className={btn.small}>
                            Correct
                          </button>
                        )}
                        {canAsk(item) && (
                          <button type="button" disabled={pending} onClick={() => draftFor([item.key])} className={btn.small}>
                            Ask supplier
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
                                if (r.ok) {
                                  setCorrecting(null);
                                  if (item.valueId) onAccepted([item.valueId]);
                                }
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
        })}
      </div>
    </section>
  );
}

