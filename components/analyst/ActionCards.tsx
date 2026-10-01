"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { generateMemoAction, saveSpecAction } from "@/app/(app)/award/actions";
import { acceptAction, sendAction } from "@/app/(app)/quotes/actions";
import type { AcceptPreview, ChatAction, ScenarioPreview, SendPreview, ViewPreview } from "@/lib/tools/actions";
import { ErrorNote } from "../ErrorNote";
import { btn, input } from "../ui/styles";

type Props<T> = { action: T; onDone: (note: string) => void };

// Every card states that nothing has changed yet; the button names exactly what happens.
function Frame({ title, children, done }: { title: string; children: React.ReactNode; done?: string }) {
  return (
    <section aria-label={title} className={`border border-rule border-l-[3px] bg-sheet p-3 text-[13px] ${done ? "border-l-ledger" : "border-l-ink"}`}>
      <p className="text-xs font-semibold text-slate">{done ? "Confirmed" : "Preview: nothing changes until you confirm"}</p>
      <h4 className="mt-0.5 text-sm font-semibold">{title}</h4>
      <div className="mt-2 space-y-2">{children}</div>
      {done && <p className="settle mt-2 text-xs text-ledger">{done}</p>}
    </section>
  );
}

function AcceptCard({ action, onDone }: Props<AcceptPreview & { status?: "done"; done_note?: string }>) {
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const confirm = (from: number) =>
    start(async () => {
      setError(null);
      for (let i = from; i < action.items.length; i++) {
        setProgress(i);
        const r = await acceptAction(action.supplier, action.items[i].key);
        if (!r.ok) {
          setError(`${r.error} ${i} of ${action.items.length} were accepted; Retry continues with the rest.`);
          setProgress(i);
          return;
        }
      }
      onDone(`${action.items.length} accepted. Each is logged separately, as on the Quotes screen.`);
    });
  return (
    <Frame title={`Accept ${action.items.length} Inferred value${action.items.length === 1 ? "" : "s"} from ${action.supplier}. ${action.supplier_name}: ${action.reason_title}`} done={action.done_note}>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-slate">
            <th className="border-b border-ink py-1 pr-2 text-left font-semibold">Line</th>
            <th className="border-b border-ink py-1 pr-2 text-right font-semibold">Value</th>
            <th className="border-b border-ink py-1 text-left font-semibold">Reason</th>
          </tr>
        </thead>
        <tbody>
          {action.items.map((it) => (
            <tr key={it.key} className="align-top">
              <td className="border-b border-rule py-1 pr-2">
                {it.line}. {it.description}
              </td>
              <td className="border-b border-rule py-1 pr-2 text-right">
                <span className="val-inferred">{it.value_display}</span>
              </td>
              <td className="border-b border-rule py-1 text-slate">{it.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!action.status && (
        <>
          {error && <ErrorNote message={error} busy={pending} onRetry={() => confirm(progress)} />}
          <div className="flex items-center gap-2">
            <button type="button" disabled={pending} onClick={() => confirm(0)} className={btn.smallPrimary}>
              {pending ? `Accepting ${progress + 1} of ${action.items.length}...` : `Accept all similar (${action.items.length})`}
            </button>
          </div>
        </>
      )}
    </Frame>
  );
}

function SendCard({ action, onDone }: Props<SendPreview & { status?: "done"; done_note?: string }>) {
  const [pending, start] = useTransition();
  const [subject, setSubject] = useState(action.draft?.subject ?? "");
  const [body, setBody] = useState(action.draft?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const send = () =>
    start(async () => {
      setError(null);
      const r = await sendAction(action.supplier, action.keys, subject, body);
      if (r.ok) onDone("Question sent (simulated). The items show Awaiting supplier on the Quotes screen.");
      else setError(r.error);
    });
  return (
    <Frame title={`Question to ${action.supplier}. ${action.supplier_name}`} done={action.done_note}>
      <ul className="list-disc pl-4 text-xs text-slate">
        {action.items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      {action.draft_error ? (
        <p className="text-xs text-oxblood">
          {action.draft_error} You can ask the supplier from the{" "}
          <Link href={`/quotes?supplier=${action.supplier}#exceptions`} className="underline">
            Quotes screen
          </Link>
          .
        </p>
      ) : action.status ? (
        <p className="whitespace-pre-wrap border-l-[3px] border-rule pl-2 text-xs">{body}</p>
      ) : (
        <>
          <label className="block text-xs text-slate">
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${input} mt-1 w-full py-1 text-[13px]`} />
          </label>
          <label className="block text-xs text-slate">
            Message
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className={`${input} mt-1 w-full py-1 text-[13px]`} />
          </label>
          {error && <ErrorNote message={error} busy={pending} onRetry={send} />}
          <button type="button" disabled={pending || !body.trim()} onClick={send} className={btn.smallPrimary}>
            {pending ? "Sending..." : "Send question"}
          </button>
        </>
      )}
    </Frame>
  );
}

function ScenarioCard({ action, onDone }: Props<ScenarioPreview & { status?: "done"; done_note?: string }>) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const blocked = action.memo_blocked;
  const confirm = () =>
    start(async () => {
      setError(null);
      const saved = await saveSpecAction(action.spec);
      if (!saved.ok) return setError(saved.error);
      if (blocked) return onDone(`${action.scenario_label} is now the chosen scenario. The memo stays blocked until the open blockers are cleared on the Award screen.`);
      const memo = await generateMemoAction();
      if (!memo.ok) return setError(`${action.scenario_label} is chosen, but the memo was not written: ${memo.error}`);
      onDone(`${action.scenario_label} chosen and the memo written. Review it on the Award screen before exporting.`);
    });
  const shown = action.open_blockers.slice(0, 6);
  return (
    <Frame title={blocked ? `Choose ${action.scenario_label}` : `Choose ${action.scenario_label} and generate the memo`} done={action.done_note}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <dt className="text-slate">Total</dt>
          <dd className="text-sm font-semibold">{action.total_display}</dd>
        </div>
        <div>
          <dt className="text-slate">Against last cycle</dt>
          <dd>{action.vs_last_cycle}</dd>
        </div>
        <div>
          <dt className="text-slate">Suppliers</dt>
          <dd>{action.suppliers.join(", ") || "None eligible"}</dd>
        </div>
        <div>
          <dt className="text-slate">Lines awarded</dt>
          <dd>
            {action.lines_awarded}
            {action.lines_not_covered.length > 0 && <span className="text-pencil">, lines {action.lines_not_covered.join(", ")} not covered</span>}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-slate">Eligibility</dt>
          <dd>{action.eligibility_note}</dd>
        </div>
      </dl>
      {blocked ? (
        <div className="border-l-[3px] border-oxblood bg-oxblood-tint px-2 py-1.5 text-xs">
          <p className="font-semibold text-oxblood">
            {action.open_blockers.length} open blocker{action.open_blockers.length === 1 ? "" : "s"}: the memo is blocked
          </p>
          <ul className="mt-1 list-disc pl-4">
            {shown.map((b, i) => (
              <li key={i}>
                {b.supplier ? `${b.supplier}${b.line !== null ? `, line ${b.line}` : ""}: ` : ""}
                {b.detail}
              </li>
            ))}
          </ul>
          {action.open_blockers.length > shown.length && <p className="mt-1">And {action.open_blockers.length - shown.length} more.</p>}
          <p className="mt-1">
            Overrides need your own typed reason, so they are made on the{" "}
            <Link href="/award#readiness" className="font-semibold underline">
              Award screen
            </Link>
            , never from chat.
          </p>
        </div>
      ) : (
        <p className="text-xs text-ledger">No open blockers: the memo can be written.</p>
      )}
      {!action.status && (
        <>
          {error && <ErrorNote message={error} busy={pending} onRetry={confirm} />}
          <button type="button" disabled={pending} onClick={confirm} className={btn.smallPrimary}>
            {pending ? "Working..." : blocked ? "Choose scenario" : "Choose scenario and generate memo"}
          </button>
        </>
      )}
      {action.status && (
        <Link href="/award" className="inline-block text-xs font-semibold underline decoration-field underline-offset-2">
          Open the Award screen
        </Link>
      )}
    </Frame>
  );
}

function ViewCard({ action }: { action: ViewPreview & { done_note?: string } }) {
  return <p className="border-l-[3px] border-rule pl-2 text-xs text-slate">{action.done_note ?? "View change for the Quote Comparison."} No data changed.</p>;
}

export function ActionCard({ action, onDone }: { action: ChatAction; onDone: (note: string) => void }) {
  switch (action.kind) {
    case "accept_values":
      return <AcceptCard action={action} onDone={onDone} />;
    case "send_clarification":
      return <SendCard action={action as SendPreview} onDone={onDone} />;
    case "choose_scenario":
      return <ScenarioCard action={action} onDone={onDone} />;
    case "set_view":
      return <ViewCard action={action} />;
  }
}
