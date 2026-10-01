"use client";

import { useContext, useEffect, useRef, useState, useTransition } from "react";
import { askAnalystAction, type AnalystReply } from "@/app/(app)/comparison/analyst-actions";
import { ErrorNote } from "../ErrorNote";
import { SidePanel } from "../ui/SidePanel";
import { btn, input } from "../ui/styles";
import { AnswerCard } from "./AnswerCard";
import { LensUiContext, ViewControlContext } from "./viewControl";

// A briefing is Lens speaking first when Priya opens the panel; it has no question bubble.
type Exchange = { question: string; reply: AnalystReply | null; error: string | null; briefing?: boolean };

const STORAGE_KEY = "quotelens.analyst.v3";
const SUGGESTIONS = [
  "Who is cheapest overall on a like-for-like basis?",
  "Only among suppliers who passed the quality questionnaire?",
  "Are any of those quotes stale or at risk before approval?",
  "If I exclude quotes that need reconfirmation, who becomes L1 per line? Show it as a chart.",
  "Which suppliers raised prices against last cycle, and on which lines?",
  "Split it: cheapest per line among qualified suppliers, excluding stale quotes. What's the total and the saving against last cycle?",
  "What must I resolve before I can send this award to Meera?",
];

function load(): Exchange[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Exchange[]) : [];
  } catch {
    return [];
  }
}

export function AnalystPanel({ onClose }: { onClose: () => void }) {
  // Conversation lives for the browser session.
  const [history, setHistory] = useState<Exchange[]>(() => (typeof window === "undefined" ? [] : load()));
  const [question, setQuestion] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const viewControl = useContext(ViewControlContext);
  const lensUi = useContext(LensUiContext);

  // Lens briefs Priya once, the first time she opens the panel in this session.
  const briefed = useRef(false);
  useEffect(() => {
    if (briefed.current || history.length) return;
    briefed.current = true;
    ask(`Priya has just opened the ${lensUi.screen === "comparison" ? "Quote Comparison" : lensUi.screen} screen. Brief her: under 60 words, then two or three suggested next steps.`, false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on first open
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Storage can be unavailable (private mode); the conversation still works in memory.
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history]);

  function ask(q: string, replaceLast = false, briefing = false) {
    const text = q.trim();
    if (!text || pending) return;
    const base = replaceLast ? history.slice(0, -1) : history;
    const turns = base.flatMap((e) => (e.reply ? [{ role: "user" as const, content: e.question }, { role: "assistant" as const, content: e.reply.answer, tools: e.reply.tools.map((t) => t.name) }] : []));
    setHistory([...base, { question: text, reply: null, error: null, briefing }]);
    setQuestion("");
    startTransition(async () => {
      const r = await askAnalystAction(text, turns, { screen: lensUi.screen, selection: lensUi.selection, briefing });
      // set_view changes only what the comparison shows, so it applies as the answer arrives.
      const reply = r.ok
        ? { ...r.reply, actions: r.reply.actions.map((a) => (a.kind === "set_view" && viewControl ? { ...a, status: "done" as const, done_note: `Comparison switched to ${viewControl.apply(a)}.` } : a)) }
        : null;
      setHistory((h) => h.map((e, i) => (i === h.length - 1 ? { ...e, reply, error: r.ok ? null : r.error } : e)));
    });
  }

  return (
    <SidePanel
      title="Lens"
      subtitle="Every number comes from a tool result and is checked."
      onClose={onClose}
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <label htmlFor="analyst-question" className="sr-only">
            Ask Lens
          </label>
          <textarea
            id="analyst-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
            rows={2}
            placeholder="Ask about prices, suppliers, freshness or the award"
            className={`${input} w-full resize-none`}
          />
          <div className="mt-2 flex items-center justify-between">
            {history.length > 0 ? (
              <button type="button" onClick={() => setHistory([])} disabled={pending} className={btn.quiet}>
                New conversation
              </button>
            ) : (
              <span />
            )}
            <button type="submit" disabled={pending || !question.trim()} className={btn.primary}>
              {pending ? "Working..." : "Ask"}
            </button>
          </div>
        </form>
      }
    >
      <div className="space-y-5">
        {history.length === 0 && (
          <div>
            <p className="text-sm text-slate">Ask about the comparison in plain language, or start with one of these:</p>
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => ask(s)} className="block w-full px-1 py-2 text-left text-sm hover:bg-tint">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {history.map((e, i) => (
          <article key={i} className="space-y-2">
            {e.briefing ? <p className="text-xs font-semibold text-slate">Briefing</p> : <p className="border-l-[3px] border-ink pl-2 text-sm font-semibold">{e.question}</p>}
            {e.reply && (
              <AnswerCard
                question={e.question}
                reply={e.reply}
                onActionDone={(ai, note) =>
                  setHistory((h) => h.map((x, xi) => (xi === i && x.reply ? { ...x, reply: { ...x.reply, actions: x.reply.actions.map((a, j) => (j === ai ? { ...a, status: "done" as const, done_note: note } : a)) } } : x)))
                }
              />
            )}
            {e.error && <ErrorNote message={e.error} busy={pending} onRetry={i === history.length - 1 ? () => ask(e.question, true, !!e.briefing) : undefined} />}
            {!e.reply && !e.error && (
              <p role="status" className="text-sm text-slate">
                Working through the tools. Most answers take 10 to 20 seconds.
              </p>
            )}
          </article>
        ))}
        <div ref={endRef} />
      </div>
    </SidePanel>
  );
}
