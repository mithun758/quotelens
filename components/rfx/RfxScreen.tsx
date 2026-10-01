"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { chatAction, newDraftAction, saveDraftAction, sendRfxAction } from "@/app/(app)/rfx/actions";
import { sendProblems, type DraftLine, type RfxDraft } from "@/lib/rfx/draft";
import type { DraftState } from "@/lib/rfx/store";
import { Markdown } from "../analyst/AnswerCard";
import { ErrorNote } from "../ErrorNote";
import { displayDate } from "../quotes/format";
import { btn } from "../ui/styles";

const SUGGESTIONS = ["We need to run our annual IT refresh across our three hubs.", "Draft the IT refresh from last year's list, with our standard questionnaire and terms."];

const specToText = (spec: DraftLine["spec"]) => spec.map((s) => `${s.attribute}: ${s.value}`).join("\n");
const textToSpec = (text: string) =>
  text
    .split("\n")
    .map((l) => l.split(":"))
    .filter((p) => p.length >= 2 && p[0].trim() && p.slice(1).join(":").trim())
    .map((p) => ({ attribute: p[0].trim(), value: p.slice(1).join(":").trim() }));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-slate">
      {label}
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

// Fields ruled like a printed form: a bottom rule, a tint while editing.
const input = "w-full rounded-xs border-0 border-b border-field bg-transparent px-1 py-1 text-[13px] text-ink hover:bg-tint focus:bg-tint disabled:border-rule disabled:hover:bg-transparent";

export function RfxScreen({ initial, supplierCount, asOfDate }: { initial: DraftState; supplierCount: number; asOfDate: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<RfxDraft>(initial.draft);
  const [saved, setSaved] = useState<RfxDraft>(initial.draft);
  const [conversation, setConversation] = useState(initial.conversation);
  const [status, setStatus] = useState(initial.status);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  // Bumped when the co-pilot replaces the draft, so per-line editors re-read their value.
  const [version, setVersion] = useState(0);
  const [sent, setSent] = useState<{ sentAt: string; suppliers: { code: string; name: string; state: string | null }[] } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const locked = status === "sent";
  const problems = sendProblems(draft, asOfDate);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation, pending]);

  const update = (patch: Partial<RfxDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const updateLine = (i: number, patch: Partial<DraftLine>) => setDraft((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  function save(): Promise<boolean> {
    return new Promise((resolve) =>
      startTransition(async () => {
        setError(null);
        const r = await saveDraftAction(draft);
        if (r.ok) {
          setSaved(r.data);
          setDraft(r.data);
        } else setError(r.error);
        resolve(r.ok);
      }),
    );
  }

  function send(text: string) {
    const msg = text.trim();
    if (!msg || pending) return;
    setMessage("");
    setFailedMessage(null);
    setConversation((c) => [...c, { role: "user", content: msg }]);
    startTransition(async () => {
      setError(null);
      if (dirty) {
        const r = await saveDraftAction(draft);
        if (!r.ok) {
          setError(r.error);
          return;
        }
      }
      const r = await chatAction(msg);
      if (r.ok) {
        setConversation(r.data.conversation);
        setDraft(r.data.draft);
        setSaved(r.data.draft);
        setVersion((v) => v + 1);
      } else {
        setError(r.error);
        setFailedMessage(msg);
        setConversation((c) => c.slice(0, -1));
      }
    });
  }

  const th = "border-b border-ink py-1 pr-2 text-left text-xs font-semibold text-slate";
  return (
    <div className="grid grid-cols-[22rem_minmax(0,1fr)] gap-6 2xl:grid-cols-[26rem_minmax(0,1fr)]">
      <aside aria-label="RFx co-pilot" className="sticky top-[4.75rem] flex h-[calc(100vh-6rem)] min-h-0 flex-col border border-rule bg-sheet">
        <div className="flex items-start justify-between gap-2 border-b border-rule px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">RFx co-pilot</h2>
            <p className="text-xs text-slate">Describe what you need; the document fills in on the right.</p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (!window.confirm("Start a new draft? This clears the current draft and conversation.")) return;
                const r = await newDraftAction();
                if (r.ok) window.location.reload();
                else setError(r.error);
              })
            }
            className={`${btn.quiet} whitespace-nowrap`}
          >
            New draft
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {conversation.length === 0 && (
            <div>
              <p className="text-sm text-slate">Tell the co-pilot what this RFx is for, or start with one of these:</p>
              <ul className="mt-2 divide-y divide-rule border-y border-rule">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => send(s)} disabled={locked} className="block w-full px-1 py-2 text-left text-sm hover:bg-tint">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {conversation.map((t, i) =>
            t.role === "user" ? (
              <p key={i} className="border-l-[3px] border-ink pl-2 text-sm font-semibold">
                {t.content}
              </p>
            ) : (
              <div key={i}>
                <Markdown text={t.content} />
              </div>
            ),
          )}
          {pending && conversation.at(-1)?.role === "user" && (
            <p role="status" className="text-sm text-slate">
              Drafting. A full RFx takes about 30 seconds.
            </p>
          )}
          <div ref={endRef} />
        </div>
        <form
          className="border-t border-rule p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(message);
          }}
        >
          <label htmlFor="copilot-message" className="sr-only">
            Message the co-pilot
          </label>
          <textarea
            id="copilot-message"
            value={message}
            disabled={locked}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(message);
              }
            }}
            rows={2}
            placeholder={locked ? "This RFx has been sent" : "Describe the purchase, or ask for changes"}
            className="w-full resize-none rounded-xs border border-field bg-sheet px-2 py-1.5 text-sm placeholder:text-slate"
          />
          <div className="mt-2 flex justify-end">
            <button type="submit" disabled={pending || locked || !message.trim()} className={btn.primary}>
              Send
            </button>
          </div>
        </form>
      </aside>

      <section aria-label="RFx draft" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="text-slate">Status </span>
            <span className="font-semibold">{locked ? `Sent${initial.sentAt ? ` ${displayDate(initial.sentAt)}` : ""}` : dirty ? "Draft, unsaved changes" : "Draft, saved"}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending || !dirty || locked} onClick={save} className={btn.secondary}>
              {dirty ? "Save draft" : "Saved"}
            </button>
            <button
              type="button"
              disabled={pending || locked || problems.length > 0}
              title={problems.join(" ")}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  if (dirty && !(await save())) return;
                  const r = await sendRfxAction();
                  if (r.ok) {
                    setSent(r.data);
                    setStatus("sent");
                  } else setError(r.error);
                })
              }
              className={btn.primary}
            >
              Send RFx
            </button>
          </div>
        </div>
        {error && <ErrorNote message={error} busy={pending} onRetry={failedMessage ? () => send(failedMessage) : undefined} />}
        {locked && <p className="border-l-[3px] border-ledger bg-ledger-tint px-3 py-2 text-sm text-ledger">Sent to {supplierCount} suppliers (simulated). Start a new draft to make changes.</p>}
        {!locked && problems.length > 0 && draft.lines.length > 0 && (
          <div className="border-l-[3px] border-amber bg-amber-tint px-3 py-2 text-xs text-pencil">
            <p className="font-semibold">Before you can send</p>
            <ul className="mt-1 list-disc pl-4">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        <article className="border border-rule bg-sheet px-8 py-7 shadow-[0_8px_24px_rgb(27_42_65/0.06)]">
          <fieldset disabled={locked} className="min-w-0 border-b-2 border-ink pb-4">
            <legend className="sr-only">RFx</legend>
            <p className="text-xs text-slate">Request for quotation, Meridian Diagnostics</p>
            <input aria-label="Title" placeholder="RFx title" className={`${input} mt-1 text-xl font-semibold`} value={draft.title} onChange={(e) => update({ title: e.target.value })} />
            <div className="mt-3 grid grid-cols-4 gap-x-5 gap-y-3">
              <Field label="Category">
                <input className={input} value={draft.category} onChange={(e) => update({ category: e.target.value })} />
              </Field>
              <Field label="Need by">
                <input type="date" className={input} value={draft.need_by_date} onChange={(e) => update({ need_by_date: e.target.value })} />
              </Field>
              <Field label="Approval days">
                <input type="number" min={0} className={input} value={draft.approval_days} onChange={(e) => update({ approval_days: Number(e.target.value) })} />
              </Field>
              <Field label="Delivery hubs">
                <input
                  placeholder="Bengaluru, Chennai"
                  className={input}
                  value={draft.delivery_hubs.join(", ")}
                  onChange={(e) =>
                    update({
                      delivery_hubs: e.target.value
                        .split(",")
                        .map((h) => h.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
            </div>
          </fieldset>

          <fieldset disabled={locked} className="mt-6 min-w-0">
            <legend className="text-base font-semibold">1. Lines</legend>
            {draft.lines.length === 0 ? (
              <p className="mt-2 border-y border-rule py-6 text-center text-sm text-slate">No lines yet. Describe the purchase to the co-pilot, or add a line yourself.</p>
            ) : (
              <table className="mt-2 w-full table-fixed border-collapse text-[13px]">
                <colgroup>
                  <col className="w-7" />
                  <col className="w-[24%]" />
                  <col />
                  <col className="w-[7.5rem]" />
                  <col className="w-14" />
                  <col className="w-16" />
                  <col className="w-[4.5rem]" />
                  <col className="w-16" />
                </colgroup>
                <thead>
                  <tr>
                    <th className={th}>#</th>
                    <th className={th}>Description</th>
                    <th className={th}>Specification, one per line</th>
                    <th className={th}>Category</th>
                    <th className={`${th} text-right`}>Qty</th>
                    <th className={th}>Unit</th>
                    <th className={th} title="Memory-exposed: laptops, desktops, SSDs">
                      Memory
                    </th>
                    <th className={th}>
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.map((l, i) => (
                    <tr key={i} className="align-top">
                      <td className="border-b border-rule py-1.5 pr-2 text-xs text-slate">{l.line_no}</td>
                      <td className="border-b border-rule py-1.5 pr-2">
                        <textarea aria-label={`Line ${l.line_no} description`} rows={2} className={`${input} resize-none`} value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                      </td>
                      <td className="border-b border-rule py-1.5 pr-2">
                        <SpecEditor key={`${version}-${l.line_no}-${draft.lines.length}`} value={l.spec} onChange={(spec) => updateLine(i, { spec })} label={`Line ${l.line_no} specification`} />
                      </td>
                      <td className="border-b border-rule py-1.5 pr-2">
                        <input aria-label={`Line ${l.line_no} category`} className={input} value={l.category} onChange={(e) => updateLine(i, { category: e.target.value })} />
                      </td>
                      <td className="border-b border-rule py-1.5 pr-2">
                        <input aria-label={`Line ${l.line_no} quantity`} type="number" min={1} className={`${input} text-right`} value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                      </td>
                      <td className="border-b border-rule py-1.5 pr-2">
                        <input aria-label={`Line ${l.line_no} unit`} className={input} value={l.uom} onChange={(e) => updateLine(i, { uom: e.target.value })} />
                      </td>
                      <td className="border-b border-rule py-1.5 pt-2.5">
                        <input aria-label={`Line ${l.line_no} memory-exposed`} type="checkbox" className="accent-ink" checked={l.memory_exposed} onChange={(e) => updateLine(i, { memory_exposed: e.target.checked })} />
                      </td>
                      <td className="border-b border-rule py-1.5 text-right">
                        <button type="button" onClick={() => update({ lines: draft.lines.filter((_, j) => j !== i).map((x, j) => ({ ...x, line_no: j + 1 })) })} className="text-xs text-slate underline decoration-rule underline-offset-2 hover:text-oxblood" aria-label={`Remove line ${l.line_no}`}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button
              type="button"
              onClick={() => update({ lines: [...draft.lines, { line_no: draft.lines.length + 1, description: "New item", category: "Other", spec: [], quantity: 1, uom: "piece", memory_exposed: false }] })}
              className={`${btn.small} mt-2`}
            >
              Add line
            </button>
          </fieldset>

          <div className="mt-7 grid grid-cols-2 gap-8">
            <fieldset disabled={locked} className="min-w-0 space-y-3">
              <legend className="text-base font-semibold">2. Commercial terms</legend>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Field label="Validity required, days">
                  <input type="number" min={0} className={input} value={draft.terms.validity_days_required} onChange={(e) => update({ terms: { ...draft.terms, validity_days_required: Number(e.target.value) } })} />
                </Field>
                <Field label="Delivery within, days">
                  <input type="number" min={0} className={input} value={draft.terms.delivery_days} onChange={(e) => update({ terms: { ...draft.terms, delivery_days: Number(e.target.value) } })} />
                </Field>
              </div>
              {(["gst_basis", "delivery_basis", "warranty", "payment", "currency"] as const).map((k) => (
                <Field key={k} label={{ gst_basis: "GST basis", delivery_basis: "Delivery basis", warranty: "Warranty", payment: "Payment", currency: "Currency" }[k]}>
                  <input className={input} value={draft.terms[k]} onChange={(e) => update({ terms: { ...draft.terms, [k]: e.target.value } })} />
                </Field>
              ))}
            </fieldset>

            <fieldset disabled={locked} className="min-w-0">
              <legend className="text-base font-semibold">3. Quality questionnaire</legend>
              <ol className="pt-2">
                {draft.questionnaire.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 border-b border-rule py-1.5">
                    <span className="w-5 shrink-0 pt-1 text-right text-xs text-slate">{i + 1}</span>
                    <textarea
                      aria-label={`Question ${i + 1}`}
                      rows={2}
                      className={`${input} resize-none border-b-0`}
                      value={q.text}
                      onChange={(e) => update({ questionnaire: draft.questionnaire.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                    />
                    <label className="flex shrink-0 items-center gap-1 pt-1 text-xs text-slate" title="Evidence document required">
                      <input
                        type="checkbox"
                        className="accent-ink"
                        checked={q.evidence_required}
                        onChange={(e) => update({ questionnaire: draft.questionnaire.map((x, j) => (j === i ? { ...x, evidence_required: e.target.checked } : x)) })}
                      />
                      Evidence
                    </label>
                    <button type="button" onClick={() => update({ questionnaire: draft.questionnaire.filter((_, j) => j !== i) })} className="shrink-0 pt-1 text-xs text-slate underline decoration-rule underline-offset-2 hover:text-oxblood" aria-label={`Remove question ${i + 1}`}>
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => update({ questionnaire: [...draft.questionnaire, { key: `question_${draft.questionnaire.length + 1}`, text: "New question", evidence_required: false }] })}
                className={`${btn.small} mt-2`}
              >
                Add question
              </button>
            </fieldset>
          </div>
        </article>
      </section>

      {sent && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 p-4">
          <div role="dialog" aria-modal="true" aria-label="RFx sent" className="panel-in w-full max-w-md space-y-3 rounded-xs border border-rule bg-sheet p-5 shadow-[0_8px_24px_rgb(27_42_65/0.18)]">
            <h3 className="text-base font-semibold">Sent to {sent.suppliers.length} suppliers</h3>
            <p className="text-sm text-slate">
              &quot;{draft.title}&quot; with {draft.lines.length} lines went out on {new Date(sent.sentAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} IST. Email sending is simulated in this prototype.
            </p>
            <ul className="border-y border-rule text-sm">
              {sent.suppliers.map((s) => (
                <li key={s.code} className="flex justify-between border-b border-rule py-1.5 last:border-b-0">
                  <span>
                    {s.code}. {s.name}
                  </span>
                  <span className="text-xs text-ledger">Sent, simulated</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate">The five supplier responses for this demo are already in. Next, review them.</p>
            <button type="button" onClick={() => router.push("/quotes")} className={`${btn.primary} w-full`}>
              Go to Quotes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Spec editor that keeps the raw text while typing and parses it into attribute/value pairs.
function SpecEditor({ value, onChange, label }: { value: DraftLine["spec"]; onChange: (spec: DraftLine["spec"]) => void; label: string }) {
  const [text, setText] = useState(() => specToText(value));
  return (
    <textarea
      aria-label={label}
      rows={Math.max(2, Math.min(6, value.length))}
      className={`${input} resize-none text-xs leading-4`}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(textToSpec(e.target.value));
      }}
    />
  );
}
