"use client";

import { Check, CircleCheck } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { acceptAction, correctAction, draftAction, receiveReplyAction, sendAction } from "@/app/(app)/quotes/actions";
import type { ValueWithLine } from "@/lib/quotes/load";
import { groupQueue } from "@/lib/review/groups";
import type { QueueItem } from "@/lib/review/queue";
import { cn } from "@/lib/utils";
import { ErrorNote } from "../ErrorNote";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { input } from "../ui/styles";
import { Value } from "../ui/Value";
import { inr } from "./format";

const SEVERITY = { high: "bg-oxblood", medium: "bg-amber", low: "bg-slate" } as const;

function CorrectForm({ onSubmit, onCancel, pending }: { onSubmit: (value: number, reason: string) => void; onCancel: () => void; pending: boolean }) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="mt-2 grid grid-cols-[8rem_1fr] gap-2 rounded-xs border border-rule bg-paper p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Number(value.replace(/,/g, "")), reason);
      }}
    >
      <label className="text-meta text-slate">
        Correct price, ₹ per piece
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" required className={`${input} mt-1 w-full`} />
      </label>
      <label className="text-meta text-slate">
        Reason, logged
        <input value={reason} onChange={(e) => setReason(e.target.value)} required className={`${input} mt-1 w-full`} />
      </label>
      <div className="col-span-2 flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          Save correction
        </Button>
        <Button type="button" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const acceptLabel = (item: QueueItem) => (item.kind === "response_flag" ? "Accept flag" : item.confidence === "missing" ? "Accept as not quoted" : "Accept value");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function ReviewQueue({
  supplierCode,
  supplierName,
  items,
  values,
  awaiting,
  onFocus,
  focusedValueId,
  onAccepted,
  next,
}: {
  supplierCode: string;
  supplierName: string;
  items: QueueItem[];
  values: ValueWithLine[];
  awaiting: number;
  onFocus: (item: QueueItem) => void;
  focusedValueId: string | null;
  onAccepted: (valueIds: string[]) => void;
  // The next supplier with open items, for the empty state.
  next: { code: string; name: string; count: number } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string; keys: string[] } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  // Accepted here but still in the list until the page refreshes: shown settled.
  const [settled, setSettled] = useState<string[]>([]);
  // Groups start open; Priya can fold any away.
  const [folded, setFolded] = useState<string[]>([]);

  const byId = useMemo(() => new Map(values.map((v) => [v.id, v])), [values]);
  const groups = useMemo(() => groupQueue(items, new Map(values.map((v) => [v.id, v.steps.map((s) => s.kind)]))), [items, values]);
  const canAsk = (i: QueueItem) => i.actions.includes("ask") && i.clarification?.status !== "awaiting";
  const canAccept = (i: QueueItem) => i.actions.includes("accept") && i.clarification?.status !== "awaiting" && !settled.includes(i.key);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string | (() => string)): void =>
    startTransition(async () => {
      setRetry(() => () => run(fn, done));
      setError(null);
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong. Try again.");
      else if (done) toast(typeof done === "function" ? done() : done);
    });

  const accept = (item: QueueItem) =>
    run(async () => {
      const r = await acceptAction(supplierCode, item.key);
      if (r.ok) {
        setSettled((s) => [...s, item.key]);
        if (item.valueId) onAccepted([item.valueId]);
      }
      return r;
    }, item.confidence === "missing" ? "Accepted as not quoted" : "Value accepted");

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
        setSettled((s) => [...s, todo[i].key]);
        if (todo[i].valueId) accepted.push(todo[i].valueId!);
      }
      setProgress(null);
      onAccepted(accepted);
      return { ok: true };
    }, `${plural(todo.length, "value")} accepted`);
  };

  const draftFor = (keys: string[]) => {
    const go = () =>
      startTransition(async () => {
        setError(null);
        setRetry(() => go);
        const result = await draftAction(supplierCode, keys);
        if (result.ok && result.data) setDraft({ ...result.data, keys });
        else if (!result.ok) setError(result.error);
      });
    go();
  };

  const open = items.filter((i) => !settled.includes(i.key)).length;

  return (
    <MotionConfig reducedMotion="user">
      <section aria-label="Review queue" className="rounded-xs border border-rule bg-sheet">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
          <div>
            <h4 className="text-heading font-semibold">{open === 0 ? "Nothing to review" : `${open} to review`}</h4>
            <p className="text-meta text-slate">Grouped by reason. Select items to ask the supplier about them together.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {awaiting > 0 && (
              <Button disabled={pending} onClick={() => run(() => receiveReplyAction(supplierCode), `Reply from ${supplierName} read`)}>
                {pending && !progress ? "Reading the reply..." : "Simulate supplier reply"}
              </Button>
            )}
            {selected.length > 0 && (
              <Button variant="primary" disabled={pending} onClick={() => draftFor(selected)}>
                {pending && !draft ? "Drafting..." : `Ask supplier (${selected.length})`}
              </Button>
            )}
          </div>
        </div>

        <div aria-live="polite">
          {progress && (
            <p className="border-b border-rule px-4 py-2 text-body">
              Accepting {progress.done + 1} of {progress.total}...
            </p>
          )}
        </div>
        {error && <ErrorNote message={error} busy={pending} onRetry={retry ?? undefined} />}

        {draft && (
          <div className="space-y-2 border-b border-rule bg-paper p-4">
            <p className="text-body font-semibold">Question to {supplierName}</p>
            <p className="text-meta text-slate">Drafted by Claude from the selected items. Edit before sending; sending is simulated.</p>
            <label className="block text-meta text-slate">
              Subject
              <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className={`${input} mt-1 w-full`} />
            </label>
            <label className="block text-meta text-slate">
              Message
              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={9} className={`${input} mt-1 w-full`} />
            </label>
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const r = await sendAction(supplierCode, draft.keys, draft.subject, draft.body);
                    if (r.ok) {
                      setDraft(null);
                      setSelected([]);
                    }
                    return r;
                  }, `Question sent to ${supplierName}`)
                }
              >
                Send question
              </Button>
              <Button onClick={() => setDraft(null)}>Discard draft</Button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-4 py-6">
            <CircleCheck aria-hidden className="size-6 stroke-[1.5] text-ledger" />
            <div>
              <p className="text-body font-semibold">Nothing left to review for this supplier</p>
              <p className="text-meta text-slate">Every value from {supplierName} is Extracted or has been accepted.</p>
            </div>
            {next ? (
              <Button asChild variant="primary">
                <Link href={`/quotes?supplier=${next.code}#exceptions`}>
                  Review {next.name} ({next.count})
                </Link>
              </Button>
            ) : (
              <Button asChild variant="primary">
                <Link href="/comparison">Go to Quote Comparison</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="max-h-[calc(100vh-17rem)] overflow-auto">
            <Accordion type="multiple" value={groups.map((g) => g.key).filter((k) => !folded.includes(k))} onValueChange={(open) => setFolded(groups.map((g) => g.key).filter((k) => !open.includes(k)))}>
              {groups.map((g) => {
                const acceptable = g.items.filter(canAccept);
                return (
                  <AccordionItem key={g.key} value={g.key}>
                    <div className="flex flex-wrap items-start gap-2 bg-paper px-4 py-2">
                      <AccordionTrigger className="min-w-[14rem]">
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-body font-semibold">
                            {g.title}
                            <Badge>{g.items.length}</Badge>
                          </span>
                          <span className="block text-meta font-normal text-slate">
                            {supplierName}. {g.note}
                          </span>
                        </span>
                      </AccordionTrigger>
                      {acceptable.length > 1 && (
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => acceptAll(acceptable)} className="ml-auto">
                          Accept all similar ({acceptable.length})
                        </Button>
                      )}
                    </div>
                    <AccordionContent>
                      <ul>
                        <AnimatePresence initial={false}>
                          {g.items.map((item) => {
                            const v = item.valueId ? byId.get(item.valueId) : undefined;
                            const focused = !!item.valueId && item.valueId === focusedValueId;
                            const done = settled.includes(item.key);
                            return (
                              <motion.li
                                key={item.key}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className={cn("overflow-hidden border-t border-rule", focused && "bg-tint")}
                              >
                                <div className="px-4 py-3">
                                  <div className="flex items-start gap-3">
                                    {done ? (
                                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-ledger" />
                                    ) : (
                                      <Checkbox
                                        aria-label={`Include ${item.headline} in a question to the supplier`}
                                        disabled={!canAsk(item)}
                                        checked={selected.includes(item.key)}
                                        onCheckedChange={(c) => setSelected(c ? [...selected, item.key] : selected.filter((k) => k !== item.key))}
                                        className="mt-0.5"
                                      />
                                    )}
                                    <button type="button" onClick={() => onFocus(item)} className="min-w-0 flex-1 text-left" aria-label={`${item.headline}: show the source`}>
                                      <span className="flex items-baseline justify-between gap-3 text-table">
                                        <span className="min-w-0 truncate font-semibold">{item.headline}</span>
                                        {v && item.kind === "value" && (
                                          <span className={cn("shrink-0 transition-colors duration-300", done ? "text-ink" : "")}>
                                            {v.normalised_value_inr !== null ? (
                                              <Value plain state={done ? "extracted" : v.confidence_state}>
                                                {inr(v.normalised_value_inr)}
                                              </Value>
                                            ) : (
                                              <Value plain state="missing" className="w-16" />
                                            )}
                                          </span>
                                        )}
                                      </span>
                                      {done ? (
                                        <span className="mt-0.5 block text-meta text-ledger">Accepted</span>
                                      ) : (
                                        <>
                                          {/* The "same as last year" group note already gives the reason. */}
                                          {item.detail && g.key !== "prior" && !(g.key === "missing" && /^not quoted\.?$/i.test(item.detail.trim())) && (
                                            <span className="mt-0.5 block text-meta whitespace-pre-line text-slate">{item.detail}</span>
                                          )}
                                          {item.flags
                                            .filter((f) => f.message !== item.detail)
                                            .map((f) => (
                                              <span key={f.id} className="mt-1 flex items-start gap-1.5 text-meta">
                                                <span aria-hidden className={cn("mt-[5px] size-1.5 shrink-0 rounded-full", SEVERITY[f.severity])} />
                                                {f.message}
                                              </span>
                                            ))}
                                          {item.clarification?.status === "awaiting" && <Badge variant="ink" className="mt-1">Awaiting supplier</Badge>}
                                          {item.clarification?.status === "answered" && <span className="mt-1 block text-meta text-ledger">Supplier replied and the reply was read. Check the value before accepting.</span>}
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  {!done && (
                                    <div className="mt-2 ml-7 flex flex-wrap gap-2">
                                      {canAccept(item) && (
                                        <Button size="sm" variant="outline" disabled={pending} onClick={() => accept(item)}>
                                          {acceptLabel(item)}
                                        </Button>
                                      )}
                                      {item.actions.includes("correct") && (
                                        <Button size="sm" variant="outline" disabled={pending} onClick={() => setCorrecting(correcting === item.key ? null : item.key)}>
                                          Correct
                                        </Button>
                                      )}
                                      {canAsk(item) && (
                                        <Button size="sm" variant="outline" disabled={pending} onClick={() => draftFor([item.key])}>
                                          Ask supplier
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                  {correcting === item.key && (
                                    <div className="ml-7">
                                      <CorrectForm
                                        pending={pending}
                                        onCancel={() => setCorrecting(null)}
                                        onSubmit={(value, reason) =>
                                          run(async () => {
                                            const r = await correctAction(supplierCode, item.key, value, reason);
                                            if (r.ok) {
                                              setCorrecting(null);
                                              setSettled((s) => [...s, item.key]);
                                              if (item.valueId) onAccepted([item.valueId]);
                                            }
                                            return r;
                                          }, "Value corrected")
                                        }
                                      />
                                    </div>
                                  )}
                                </div>
                              </motion.li>
                            );
                          })}
                        </AnimatePresence>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </section>
    </MotionConfig>
  );
}
