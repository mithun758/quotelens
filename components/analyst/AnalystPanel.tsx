"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { askAnalystAction, type AnalystReply } from "@/app/(app)/comparison/analyst-actions";
import { AnswerCard } from "./AnswerCard";

type Exchange = { question: string; reply: AnalystReply | null; error: string | null };

const STORAGE_KEY = "quotelens.analyst.v1";
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

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Storage can be unavailable (private mode); the conversation still works in memory.
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history]);

  function ask(q: string) {
    const text = q.trim();
    if (!text || pending) return;
    const turns = history.flatMap((e) => (e.reply ? [{ role: "user" as const, content: e.question }, { role: "assistant" as const, content: e.reply.answer }] : []));
    setHistory((h) => [...h, { question: text, reply: null, error: null }]);
    setQuestion("");
    startTransition(async () => {
      const r = await askAnalystAction(text, turns);
      setHistory((h) => h.map((e, i) => (i === h.length - 1 ? { ...e, reply: r.ok ? r.reply : null, error: r.ok ? null : r.error } : e)));
    });
  }

  return (
    <aside aria-label="Analyst" className="flex h-full min-h-0 flex-col rounded-md border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold">Analyst</h3>
          <p className="text-[11px] text-zinc-500">Every number comes from a tool result, and is checked.</p>
        </div>
        <div className="flex gap-1">
          {history.length > 0 && (
            <button type="button" onClick={() => setHistory([])} disabled={pending} className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100">
              New conversation
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100" aria-label="Hide analyst">
            Hide
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {history.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-zinc-600">Ask about the comparison in plain language. Try:</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="block w-full rounded border border-zinc-200 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50">
                {s}
              </button>
            ))}
          </div>
        )}
        {history.map((e, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-6 rounded-md bg-zinc-900 px-3 py-2 text-sm text-white">{e.question}</p>
            {e.reply && <AnswerCard question={e.question} reply={e.reply} />}
            {e.error && <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">{e.error}</p>}
            {!e.reply && !e.error && <p className="text-sm text-zinc-500">Working through the tools...</p>}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-zinc-200 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="analyst-question" className="sr-only">
          Ask the analyst
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
          className="w-full resize-none rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <div className="mt-1 flex justify-end">
          <button type="submit" disabled={pending || !question.trim()} className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50">
            {pending ? "Thinking..." : "Ask"}
          </button>
        </div>
      </form>
    </aside>
  );
}
