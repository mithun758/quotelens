"use client";

import { FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { newDraftAction, saveDraftAction, sendRfxAction } from "@/app/(app)/rfx/actions";
import { sendProblems, type DraftLine, type RfxDraft } from "@/lib/rfx/draft";
import type { DraftState } from "@/lib/rfx/store";
import { cn } from "@/lib/utils";
import { ErrorNote } from "../ErrorNote";
import { useLens, useLensScreen } from "../lens/LensProvider";
import { displayDate } from "../quotes/format";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const specToText = (spec: DraftLine["spec"]) => spec.map((s) => `${s.attribute}: ${s.value}`).join("\n");
const textToSpec = (text: string) =>
  text
    .split("\n")
    .map((l) => l.split(":"))
    .filter((p) => p.length >= 2 && p[0].trim() && p.slice(1).join(":").trim())
    .map((p) => ({ attribute: p[0].trim(), value: p.slice(1).join(":").trim() }));
const BRAND_ATTRS = ["Brand required", "Reason for brand"];

// Fields ruled like a printed form: a bottom rule only, a tint while editing.
const field = "w-full rounded-none border-0 border-b border-slate bg-transparent px-1 py-1 text-table text-ink placeholder:text-slate hover:bg-tint focus:bg-tint disabled:border-rule disabled:hover:bg-transparent";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-meta text-slate", className)}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

// A number field that shows its placeholder rather than a 0 when empty.
function NumberField({ value, onChange, placeholder, label, className }: { value: number; onChange: (n: number) => void; placeholder: string; label: string; className?: string }) {
  return <input type="number" min={0} aria-label={label} placeholder={placeholder} className={cn(field, className)} value={value ? value : ""} onChange={(e) => onChange(Number(e.target.value) || 0)} />;
}

// Delivery hubs as chips; type a hub and press Enter or a comma to add it.
function HubChips({ hubs, onChange, disabled }: { hubs: string[]; onChange: (hubs: string[]) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  const add = () => {
    const h = text.trim().replace(/,$/, "");
    if (h && !hubs.includes(h)) onChange([...hubs, h]);
    setText("");
  };
  return (
    <div className={cn("flex min-h-[27px] flex-wrap items-center gap-1 border-b border-slate px-1 py-1", disabled && "border-rule")}>
      {hubs.map((h) => (
        <Badge key={h} className="text-ink">
          {h}
          {!disabled && (
            <button type="button" aria-label={`Remove ${h}`} onClick={() => onChange(hubs.filter((x) => x !== h))} className="text-slate hover:text-oxblood">
              <X aria-hidden className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      {!disabled && (
        <input
          aria-label="Add a delivery hub"
          placeholder={hubs.length ? "Add hub" : "Bengaluru, Chennai"}
          className="min-w-20 flex-1 bg-transparent text-table outline-none placeholder:text-slate"
          value={text}
          onChange={(e) => (e.target.value.endsWith(",") ? (setText(e.target.value), setTimeout(add)) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !text && hubs.length) onChange(hubs.slice(0, -1));
          }}
          onBlur={add}
        />
      )}
    </div>
  );
}

// "Saved 2 min ago", from the draft's last save; worked out in the browser after load.
function savedAgo(iso: string | null, now: number): string {
  if (!iso || !now) return "saved";
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  return mins < 1 ? "saved just now" : mins < 60 ? `saved ${mins} min ago` : `saved ${displayDate(iso)}`;
}

export function RfxScreen({ initial, suppliers, asOfDate }: { initial: DraftState; suppliers: { code: string; name: string }[]; asOfDate: string }) {
  const router = useRouter();
  const lens = useLens();
  const [draft, setDraft] = useState<RfxDraft>(initial.draft);
  const [saved, setSaved] = useState<RfxDraft>(initial.draft);
  const [savedAt, setSavedAt] = useState<string | null>(initial.updatedAt);
  const [status, setStatus] = useState(initial.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [editingSpec, setEditingSpec] = useState<number | null>(null);
  // The screen remounts when Lens changes the draft (keyed by its update time), so the
  // per-line editors re-read their values.
  const version = initial.updatedAt ?? "new";
  const [sent, setSent] = useState<{ sentAt: string; suppliers: { code: string; name: string; state: string | null }[] } | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const locked = status === "sent";
  const problems = sendProblems(draft, asOfDate);

  // A minute clock for "saved 2 min ago".
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts after mount so the server render matches
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const update = (patch: Partial<RfxDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const updateLine = (i: number, patch: Partial<DraftLine>) => setDraft((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  function save(quiet = false): Promise<boolean> {
    return new Promise((resolve) =>
      startTransition(async () => {
        setError(null);
        const r = await saveDraftAction(draft);
        if (r.ok) {
          setSaved(r.data);
          setDraft(r.data);
          setSavedAt(new Date().toISOString());
          if (!quiet) toast("Draft saved");
        } else setError(r.error);
        resolve(r.ok);
      }),
    );
  }

  // Lens drafts from the saved draft, so unsaved edits are saved before Lens runs.
  useLensScreen({
    selection: locked ? "sent RFx (read-only)" : `draft with ${draft.lines.length} line${draft.lines.length === 1 ? "" : "s"}${dirty ? ", unsaved edits" : ""}`,
    beforeAsk: async () => {
      if (dirty && !locked) await saveDraftAction(draft);
    },
  });

  const send = () =>
    startTransition(async () => {
      setError(null);
      if (dirty && !(await save(true))) return;
      const r = await sendRfxAction();
      if (r.ok) {
        setConfirmSend(false);
        setSent(r.data);
        setStatus("sent");
        toast(`RFx sent to ${r.data.suppliers.length} suppliers`);
      } else setError(r.error);
    });

  const th = "border-b-2 border-rule-strong py-2 pr-3 text-left text-meta font-semibold text-slate";
  return (
    <div className="space-y-6">
      <ScreenHeader
        title="RFx workspace"
        description="Draft the request for quotation with Lens, check it, and send it to the onboarded suppliers."
        actions={
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmNew(true)}>
            <Plus aria-hidden />
            New draft
          </Button>
        }
      />
      {error && <ErrorNote message={error} />}

      <article aria-label="RFx document" className="mx-auto max-w-[880px] rounded-xs border border-rule bg-sheet">
        <div className="space-y-10 p-12">
          {locked && (
            <p className="rounded-xs border-l-2 border-ledger bg-ledger-tint px-3 py-2 text-body text-ledger">
              Sent to {suppliers.length} suppliers{initial.sentAt ? ` on ${displayDate(initial.sentAt)}` : ""} (simulated). Start a new draft to make changes.
            </p>
          )}
          <fieldset disabled={locked} className="min-w-0 border-b-2 border-ink pb-6">
            <legend className="sr-only">RFx</legend>
            <p className="text-meta text-slate">Request for quotation, Meridian Diagnostics</p>
            <input aria-label="Title" placeholder="RFx title" className={`${field} mt-1 text-title font-semibold`} value={draft.title} onChange={(e) => update({ title: e.target.value })} />
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 @3xl:grid-cols-4">
              <Field label="Category">
                <input className={field} placeholder="IT hardware" value={draft.category} onChange={(e) => update({ category: e.target.value })} />
              </Field>
              <Field label="Need by">
                <input type="date" className={field} value={draft.need_by_date} onChange={(e) => update({ need_by_date: e.target.value })} />
              </Field>
              <Field label="Approval days">
                <NumberField label="Approval days" placeholder="Days" value={draft.approval_days} onChange={(n) => update({ approval_days: n })} />
              </Field>
              <div className="block text-meta text-slate">
                <span id="hubs-label">Delivery hubs</span>
                <div className="mt-1" aria-labelledby="hubs-label">
                  <HubChips hubs={draft.delivery_hubs} disabled={locked} onChange={(delivery_hubs) => update({ delivery_hubs })} />
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset disabled={locked} className="min-w-0 space-y-2">
            <legend className="text-heading font-semibold">1. Lines</legend>
            {draft.lines.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-xs border border-dashed border-slate px-6 py-8">
                <FileText aria-hidden className="size-6 stroke-[1.5] text-slate" />
                <p className="text-body">Tell Lens what you need to buy and it drafts the lines, terms and questionnaire here. Every field stays editable.</p>
                <Button variant="primary" onClick={() => lens.setOpen(true)}>
                  Open Lens
                </Button>
              </div>
            ) : (
              <table className="w-full table-fixed border-collapse text-table">
                <colgroup>
                  <col className="w-8" />
                  <col className="w-[32%]" />
                  <col />
                  <col className="w-16" />
                  <col className="w-20" />
                  <col className="w-16" />
                </colgroup>
                <thead>
                  <tr>
                    <th className={th}>#</th>
                    <th className={th}>Item</th>
                    <th className={th}>Specification</th>
                    <th className={`${th} text-right`}>Qty</th>
                    <th className={th}>Unit</th>
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.map((l, i) => {
                    const brand = l.spec.find((s) => s.attribute === "Brand required");
                    const reason = l.spec.find((s) => s.attribute === "Reason for brand");
                    const attrs = l.spec.filter((s) => !BRAND_ATTRS.includes(s.attribute));
                    return (
                      <tr key={i} className="group align-top hover:bg-tint/50">
                        <td className="border-b border-rule py-2 pr-2 text-meta text-slate">{l.line_no}</td>
                        <td className="border-b border-rule py-2 pr-3">
                          <input aria-label={`Line ${l.line_no} description`} className={`${field} font-semibold`} value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                          <div className="mt-1 flex items-center gap-2">
                            <input aria-label={`Line ${l.line_no} category`} className={`${field} w-28 text-meta`} value={l.category} onChange={(e) => updateLine(i, { category: e.target.value })} />
                            <label className="flex shrink-0 items-center gap-1.5 text-meta text-slate">
                              <Checkbox checked={l.memory_exposed} disabled={locked} onCheckedChange={(c) => updateLine(i, { memory_exposed: c === true })} aria-label={`Line ${l.line_no} memory-exposed`} />
                              Memory
                            </label>
                          </div>
                          {brand && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0} className="mt-1 inline-block">
                                  <Badge variant="pencil">Brand named, reason recorded</Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {brand.value}. {reason?.value ?? "No reason recorded."}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </td>
                        <td className="border-b border-rule py-2 pr-3">
                          {editingSpec === i && !locked ? (
                            <SpecEditor key={`${version}-${l.line_no}-${draft.lines.length}`} value={l.spec} onChange={(spec) => updateLine(i, { spec })} label={`Line ${l.line_no} specification, one attribute per line`} onDone={() => setEditingSpec(null)} />
                          ) : attrs.length ? (
                            <span className="flex flex-wrap gap-1">
                              {attrs.map((s) => (
                                <Badge key={`${s.attribute}-${s.value}`} className="max-w-full text-ink" title={s.attribute}>
                                  <span className="truncate">{s.value}</span>
                                </Badge>
                              ))}
                            </span>
                          ) : (
                            <span className="text-meta text-oxblood">No specification yet</span>
                          )}
                        </td>
                        <td className="border-b border-rule py-2 pr-2">
                          <input aria-label={`Line ${l.line_no} quantity`} type="number" min={1} className={`${field} text-right`} value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                        </td>
                        <td className="border-b border-rule py-2 pr-2">
                          <input aria-label={`Line ${l.line_no} unit`} className={field} value={l.uom} onChange={(e) => updateLine(i, { uom: e.target.value })} />
                        </td>
                        <td className="border-b border-rule py-2 text-right">
                          {!locked && (
                            <span className="inline-flex gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                              <Button variant="ghost" size="icon-sm" aria-label={`Edit the specification of line ${l.line_no}`} onClick={() => setEditingSpec(editingSpec === i ? null : i)}>
                                <Pencil aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remove line ${l.line_no}`}
                                onClick={() => update({ lines: draft.lines.filter((_, j) => j !== i).map((x, j) => ({ ...x, line_no: j + 1 })) })}
                                className="hover:text-oxblood"
                              >
                                <Trash2 aria-hidden />
                              </Button>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!locked && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => update({ lines: [...draft.lines, { line_no: draft.lines.length + 1, description: "New item", category: "Other", spec: [], quantity: 1, uom: "piece", memory_exposed: false }] })}
              >
                <Plus aria-hidden />
                Add line
              </Button>
            )}
          </fieldset>

          <div className="grid gap-10 min-[1400px]:grid-cols-2">
            <fieldset disabled={locked} className="min-w-0 space-y-3">
              <legend className="text-heading font-semibold">2. Commercial terms</legend>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2">
                <Field label="Validity required, days">
                  <NumberField label="Validity required, days" placeholder="Days" value={draft.terms.validity_days_required} onChange={(n) => update({ terms: { ...draft.terms, validity_days_required: n } })} />
                </Field>
                <Field label="Delivery within, days">
                  <NumberField label="Delivery within, days" placeholder="Days" value={draft.terms.delivery_days} onChange={(n) => update({ terms: { ...draft.terms, delivery_days: n } })} />
                </Field>
                {(["gst_basis", "delivery_basis", "warranty", "payment", "currency"] as const).map((k) => (
                  <Field key={k} label={{ gst_basis: "GST basis", delivery_basis: "Delivery basis", warranty: "Warranty", payment: "Payment", currency: "Currency" }[k]}>
                    <input className={field} placeholder="Not set" value={draft.terms[k]} onChange={(e) => update({ terms: { ...draft.terms, [k]: e.target.value } })} />
                  </Field>
                ))}
              </div>
            </fieldset>

            <fieldset disabled={locked} className="min-w-0 space-y-2">
              <legend className="text-heading font-semibold">3. Quality questionnaire</legend>
              <ol className="pt-2">
                {draft.questionnaire.map((q, i) => (
                  <li key={i} className="group flex items-start gap-2 border-b border-rule py-2">
                    <span className="w-5 shrink-0 pt-1 text-right text-meta text-slate">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <textarea
                        aria-label={`Question ${i + 1}`}
                        rows={2}
                        className={`${field} resize-none border-b-0`}
                        value={q.text}
                        onChange={(e) => update({ questionnaire: draft.questionnaire.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                      />
                      <div className="mt-1 flex items-center gap-3">
                        <Badge>Required</Badge>
                        <label className="flex items-center gap-1.5 text-meta text-slate">
                          <Checkbox
                            checked={q.evidence_required}
                            disabled={locked}
                            onCheckedChange={(c) => update({ questionnaire: draft.questionnaire.map((x, j) => (j === i ? { ...x, evidence_required: c === true } : x)) })}
                          />
                          Evidence document
                        </label>
                      </div>
                    </div>
                    {!locked && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove question ${i + 1}`}
                        onClick={() => update({ questionnaire: draft.questionnaire.filter((_, j) => j !== i) })}
                        className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-oxblood"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
              {!locked && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update({ questionnaire: [...draft.questionnaire, { key: `question_${draft.questionnaire.length + 1}`, text: "New question", evidence_required: false }] })}
                >
                  <Plus aria-hidden />
                  Add question
                </Button>
              )}
            </fieldset>
          </div>
        </div>

        {!locked && (
          <footer className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-b-xs border-t border-rule bg-sheet px-12 py-3">
            <span className="text-meta text-slate">
              Draft, {dirty ? <span className="font-semibold text-ink">unsaved changes</span> : savedAgo(savedAt, now)}
            </span>
            {problems.length > 0 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-meta font-semibold text-pencil underline decoration-amber underline-offset-4">
                    {problems.length} item{problems.length === 1 ? "" : "s"} missing before sending
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start">
                  <p className="text-body font-semibold">Before you can send</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-meta">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            ) : (
              <span className="text-meta font-semibold text-ledger">Ready to send</span>
            )}
            <span className="ml-auto flex gap-2">
              <Button disabled={pending || !dirty} onClick={() => save()}>
                {dirty ? "Save draft" : "Saved"}
              </Button>
              <Button variant="primary" disabled={pending || problems.length > 0} onClick={() => setConfirmSend(true)}>
                Send RFx
              </Button>
            </span>
          </footer>
        )}
      </article>

      <Dialog open={confirmNew} onOpenChange={(o) => !pending && setConfirmNew(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new draft?</DialogTitle>
            <DialogDescription>This clears the current draft, its lines, terms and questionnaire.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={pending}>Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await newDraftAction();
                  if (r.ok) window.location.reload();
                  else {
                    setConfirmNew(false);
                    setError(r.error);
                  }
                })
              }
            >
              New draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSend} onOpenChange={(o) => !pending && setConfirmSend(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send RFx</DialogTitle>
            <DialogDescription>
              &quot;{draft.title}&quot;, {draft.lines.length} line{draft.lines.length === 1 ? "" : "s"}, goes to every onboarded supplier. Sending is simulated in this prototype.
            </DialogDescription>
          </DialogHeader>
          <ul className="rounded-xs border border-rule">
            {suppliers.map((s) => (
              <li key={s.code} className="flex items-center gap-3 border-b border-rule px-3 py-2 text-body last:border-b-0">
                <Checkbox checked disabled aria-label={`${s.name} included`} />
                <span className="flex-1">
                  <span className="text-slate">{s.code}</span> {s.name}
                </span>
                <span className="text-meta text-slate">Email</span>
              </li>
            ))}
          </ul>
          <p className="text-meta text-slate">This demo sends to all {suppliers.length} onboarded suppliers.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={pending}>Cancel</Button>
            </DialogClose>
            <Button variant="primary" disabled={pending} onClick={send}>
              {pending ? "Sending..." : "Send RFx"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sent} onOpenChange={(o) => !o && setSent(null)}>
        <DialogContent>
          {sent && (
            <>
              <DialogHeader>
                <DialogTitle>Sent to {sent.suppliers.length} suppliers</DialogTitle>
                <DialogDescription>
                  &quot;{draft.title}&quot; with {draft.lines.length} lines went out on {new Date(sent.sentAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} IST. Email sending is simulated in this prototype.
                </DialogDescription>
              </DialogHeader>
              <ul className="rounded-xs border border-rule text-body">
                {sent.suppliers.map((s) => (
                  <li key={s.code} className="flex justify-between border-b border-rule px-3 py-2 last:border-b-0">
                    <span>
                      <span className="text-slate">{s.code}</span> {s.name}
                    </span>
                    <span className="text-meta text-ledger">Sent, simulated</span>
                  </li>
                ))}
              </ul>
              <p className="text-meta text-slate">The five supplier responses for this demo are already in. Next, review them.</p>
              <DialogFooter>
                <Button variant="primary" onClick={() => router.push("/quotes")}>
                  Go to Quotes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Spec editor that keeps the raw text while typing and parses it into attribute/value pairs.
function SpecEditor({ value, onChange, label, onDone }: { value: DraftLine["spec"]; onChange: (spec: DraftLine["spec"]) => void; label: string; onDone: () => void }) {
  const [text, setText] = useState(() => specToText(value));
  return (
    <div className="space-y-1">
      <textarea
        aria-label={label}
        autoFocus
        rows={Math.max(3, Math.min(10, value.length + 1))}
        className={`${field} resize-none text-meta leading-4`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(textToSpec(e.target.value));
        }}
      />
      <p className="flex items-center justify-between text-meta text-slate">
        One attribute per line, as Attribute: value.
        <Button variant="link" size="sm" onClick={onDone}>
          Done
        </Button>
      </p>
    </div>
  );
}
