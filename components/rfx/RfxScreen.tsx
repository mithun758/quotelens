"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { chatAction, newDraftAction, saveDraftAction, sendRfxAction } from "@/app/(app)/rfx/actions";
import { sendProblems, type DraftLine, type RfxDraft } from "@/lib/rfx/draft";
import type { DraftState } from "@/lib/rfx/store";
import { Markdown } from "../analyst/AnswerCard";

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
    <label className="block text-xs text-zinc-600">
      {label}
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

const input = "w-full rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900 disabled:bg-zinc-50";

export function RfxScreen({ initial, supplierCount, asOfDate }: { initial: DraftState; supplierCount: number; asOfDate: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<RfxDraft>(initial.draft);
  const [saved, setSaved] = useState<RfxDraft>(initial.draft);
  const [conversation, setConversation] = useState(initial.conversation);
  const [status, setStatus] = useState(initial.status);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
        setConversation((c) => c.slice(0, -1));
        setMessage(msg);
      }
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <aside aria-label="RFx co-pilot" className="flex h-[78vh] min-h-0 flex-col rounded-md border border-zinc-200 bg-white xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
          <div>
            <h2 className="text-sm font-semibold">RFx co-pilot</h2>
            <p className="text-[11px] text-zinc-500">Describe what you need; the draft fills in on the right.</p>
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
            className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            New draft
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {conversation.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-600">Tell the co-pilot what this RFx is for. Try:</p>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} disabled={locked} className="block w-full rounded border border-zinc-200 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50">
                  {s}
                </button>
              ))}
            </div>
          )}
          {conversation.map((t, i) =>
            t.role === "user" ? (
              <p key={i} className="ml-6 rounded-md bg-zinc-900 px-3 py-2 text-sm text-white">
                {t.content}
              </p>
            ) : (
              <div key={i} className="rounded-md bg-zinc-50 px-3 py-2">
                <Markdown text={t.content} />
              </div>
            ),
          )}
          {pending && conversation.at(-1)?.role === "user" && <p className="text-sm text-zinc-500">Drafting...</p>}
          <div ref={endRef} />
        </div>
        <form
          className="border-t border-zinc-200 p-2"
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
            className="w-full resize-none rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <div className="mt-1 flex justify-end">
            <button type="submit" disabled={pending || locked || !message.trim()} className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50">
              Send
            </button>
          </div>
        </form>
      </aside>

      <section aria-label="RFx draft" className="min-w-0 space-y-4">
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {locked && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Sent to {supplierCount} suppliers{initial.sentAt ? ` on ${new Date(initial.sentAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} IST` : ""} (simulated). Start a new draft to make changes.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{draft.title || "New RFx draft"}</h2>
            <p className="text-sm text-zinc-600">
              {draft.lines.length} line{draft.lines.length === 1 ? "" : "s"} · {draft.questionnaire.length} questionnaire questions · every field is editable
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending || !dirty || locked} onClick={save} className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50">
              {dirty ? "Save changes" : "Saved"}
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
              className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-800 disabled:opacity-40"
            >
              Send to suppliers
            </button>
          </div>
        </div>
        {!locked && problems.length > 0 && draft.lines.length > 0 && (
          <ul className="list-disc rounded-md border border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <fieldset disabled={locked} className="grid gap-3 rounded-md border border-zinc-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
          <legend className="px-1 text-xs font-medium text-zinc-500">RFx</legend>
          <div className="sm:col-span-2">
            <Field label="Title">
              <input className={input} value={draft.title} onChange={(e) => update({ title: e.target.value })} />
            </Field>
          </div>
          <Field label="Category">
            <input className={input} value={draft.category} onChange={(e) => update({ category: e.target.value })} />
          </Field>
          <Field label="Need by">
            <input type="date" className={input} value={draft.need_by_date} onChange={(e) => update({ need_by_date: e.target.value })} />
          </Field>
          <Field label="Approval days">
            <input type="number" min={0} className={input} value={draft.approval_days} onChange={(e) => update({ approval_days: Number(e.target.value) })} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-5">
            <Field label="Delivery hubs (comma separated)">
              <input
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

        <fieldset disabled={locked} className="rounded-md border border-zinc-200 bg-white">
          <legend className="ml-3 px-1 text-xs font-medium text-zinc-500">Lines</legend>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-2 py-1 text-left">#</th>
                  <th className="px-2 py-1 text-left">Description</th>
                  <th className="px-2 py-1 text-left">Specification (attribute: value, one per line)</th>
                  <th className="px-2 py-1 text-left">Category</th>
                  <th className="px-2 py-1 text-right">Qty</th>
                  <th className="px-2 py-1 text-left">Unit</th>
                  <th className="px-2 py-1 text-center" title="Memory-exposed: laptops, desktops, SSDs">Mem</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((l, i) => (
                  <tr key={i} className="border-t border-zinc-100 align-top">
                    <td className="px-2 py-1 text-zinc-500">{l.line_no}</td>
                    <td className="px-2 py-1">
                      <textarea aria-label={`Line ${l.line_no} description`} rows={2} className={input} value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                    </td>
                    <td className="px-2 py-1">
                      <SpecEditor key={`${version}-${l.line_no}-${draft.lines.length}`} value={l.spec} onChange={(spec) => updateLine(i, { spec })} label={`Line ${l.line_no} specification`} />
                    </td>
                    <td className="w-36 px-2 py-1">
                      <input aria-label={`Line ${l.line_no} category`} className={input} value={l.category} onChange={(e) => updateLine(i, { category: e.target.value })} />
                    </td>
                    <td className="w-20 px-2 py-1">
                      <input aria-label={`Line ${l.line_no} quantity`} type="number" min={1} className={`${input} text-right`} value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                    </td>
                    <td className="w-20 px-2 py-1">
                      <input aria-label={`Line ${l.line_no} unit`} className={input} value={l.uom} onChange={(e) => updateLine(i, { uom: e.target.value })} />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input aria-label={`Line ${l.line_no} memory-exposed`} type="checkbox" checked={l.memory_exposed} onChange={(e) => updateLine(i, { memory_exposed: e.target.checked })} />
                    </td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => update({ lines: draft.lines.filter((_, j) => j !== i).map((x, j) => ({ ...x, line_no: j + 1 })) })} className="text-xs text-zinc-500 hover:text-red-700" aria-label={`Remove line ${l.line_no}`}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => update({ lines: [...draft.lines, { line_no: draft.lines.length + 1, description: "New item", category: "Other", spec: [], quantity: 1, uom: "piece", memory_exposed: false }] })}
            className="m-2 rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
          >
            Add line
          </button>
        </fieldset>

        <div className="grid gap-4 lg:grid-cols-2">
          <fieldset disabled={locked} className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
            <legend className="px-1 text-xs font-medium text-zinc-500">Commercial terms</legend>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Quote validity required (days)">
                <input type="number" min={0} className={input} value={draft.terms.validity_days_required} onChange={(e) => update({ terms: { ...draft.terms, validity_days_required: Number(e.target.value) } })} />
              </Field>
              <Field label="Delivery within (days)">
                <input type="number" min={0} className={input} value={draft.terms.delivery_days} onChange={(e) => update({ terms: { ...draft.terms, delivery_days: Number(e.target.value) } })} />
              </Field>
            </div>
            {(["gst_basis", "delivery_basis", "warranty", "payment", "currency"] as const).map((k) => (
              <Field key={k} label={{ gst_basis: "GST basis", delivery_basis: "Delivery basis", warranty: "Warranty", payment: "Payment", currency: "Currency" }[k]}>
                <input className={input} value={draft.terms[k]} onChange={(e) => update({ terms: { ...draft.terms, [k]: e.target.value } })} />
              </Field>
            ))}
          </fieldset>

          <fieldset disabled={locked} className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
            <legend className="px-1 text-xs font-medium text-zinc-500">Quality questionnaire</legend>
            {draft.questionnaire.map((q, i) => (
              <div key={i} className="flex gap-2">
                <input
                  aria-label={`Question ${i + 1}`}
                  className={input}
                  value={q.text}
                  onChange={(e) => update({ questionnaire: draft.questionnaire.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                />
                <label className="flex shrink-0 items-center gap-1 text-xs text-zinc-600" title="Evidence document required">
                  <input
                    type="checkbox"
                    checked={q.evidence_required}
                    onChange={(e) => update({ questionnaire: draft.questionnaire.map((x, j) => (j === i ? { ...x, evidence_required: e.target.checked } : x)) })}
                  />
                  Evidence
                </label>
                <button type="button" onClick={() => update({ questionnaire: draft.questionnaire.filter((_, j) => j !== i) })} className="shrink-0 text-xs text-zinc-500 hover:text-red-700" aria-label={`Remove question ${i + 1}`}>
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update({ questionnaire: [...draft.questionnaire, { key: `question_${draft.questionnaire.length + 1}`, text: "New question", evidence_required: false }] })}
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
            >
              Add question
            </button>
          </fieldset>
        </div>
      </section>

      {sent && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/30 p-4">
          <div role="dialog" aria-modal="true" aria-label="RFx sent" className="w-full max-w-md space-y-3 rounded-md bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Sent to {sent.suppliers.length} suppliers</h3>
            <p className="text-sm text-zinc-600">
              &quot;{draft.title}&quot; with {draft.lines.length} lines went out on {new Date(sent.sentAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} IST. Email sending is simulated in this prototype.
            </p>
            <ul className="space-y-1 text-sm">
              {sent.suppliers.map((s) => (
                <li key={s.code} className="flex justify-between rounded border border-zinc-200 px-2 py-1">
                  <span>
                    {s.code}. {s.name}
                  </span>
                  <span className="text-xs text-emerald-700">Sent (simulated)</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-zinc-500">The five supplier responses for this demo are already in. Next, review them.</p>
            <button type="button" onClick={() => router.push("/quotes")} className="w-full rounded bg-zinc-900 px-3 py-2 text-sm text-white">
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
      className={`${input} font-mono text-xs`}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(textToSpec(e.target.value));
      }}
    />
  );
}
