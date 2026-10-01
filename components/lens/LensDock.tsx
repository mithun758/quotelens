"use client";

import { useEffect, useRef, useState } from "react";
import type { LensScreen } from "@/lib/ai/lens/context";
import { activityNow, describeToolCall } from "@/lib/ai/lens/activity";
import { AnswerCard, Markdown } from "../analyst/AnswerCard";
import { CiteContext } from "../analyst/cite";
import { ErrorNote } from "../ErrorNote";
import { btn, input } from "../ui/styles";
import { DockSheetContext } from "../ui/SidePanel";
import { useLens, type Exchange } from "./LensProvider";

const SCREEN_NAME: Record<LensScreen, string> = { rfx: "RFx", quotes: "Quotes", comparison: "Quote Comparison", award: "Award", eval: "Eval" };

// Suggested prompts for the current screen, shown until Priya has asked something here.
const SUGGESTIONS: Record<LensScreen, string[]> = {
  rfx: ["We need 60 business laptops for the labs.", "Check this draft before I send it.", "Is the quote validity long enough for approval?"],
  quotes: ["What needs me first?", "Accept all of Prakash's GST ones.", "Ask Lionbridge about the lines it didn't quote."],
  comparison: ["Who is cheapest on a like-for-like basis?", "Are any of those quotes stale or at risk before approval?", "Show me the decision-ready prices."],
  award: ["What must I resolve before I can send this award to Meera?", "Compare Best Quote with the incumbent.", "Ask Sri Ganesh to reconfirm its prices."],
  eval: ["What do these accuracy figures measure?", "Which extraction errors remain?"],
};

function Monogram() {
  return (
    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-xs bg-ink text-sm font-semibold text-white">
      L
    </span>
  );
}

function Message({ e, busy }: { e: Exchange; busy: boolean }) {
  const { ask, markActionDone } = useLens();
  const [showSteps, setShowSteps] = useState(false);
  return (
    <article className="space-y-2">
      {e.briefing ? <p className="text-xs font-semibold text-slate">Briefing</p> : <p className="border-l-[3px] border-ink pl-2 text-sm font-semibold">{e.question}</p>}
      {e.reply && (
        <AnswerCard
          question={e.question}
          reply={e.reply}
          busy={busy}
          onAsk={(q) => ask(q)}
          onActionDone={(i, note) => markActionDone(e.id, i, note)}
        />
      )}
      {e.live && (
        <div aria-live="polite" className="space-y-2">
          {e.live.text ? <Markdown text={e.live.text} /> : null}
          <p className="flex items-center gap-2 text-xs text-slate">
            <span className="lens-typing" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            {e.live.now ? `${activityNow(e.live.now)}...` : e.live.text ? "Writing..." : e.briefing ? "Looking over this screen..." : "Reading your question..."}
          </p>
          {e.live.steps.length > 0 && (
            <button type="button" onClick={() => setShowSteps(!showSteps)} className="text-xs text-slate underline decoration-rule underline-offset-2">
              {showSteps ? "Hide" : "Show"} what Lens did so far ({e.live.steps.length})
            </button>
          )}
          {showSteps && (
            <ol className="list-decimal pl-4 text-xs text-slate">
              {e.live.steps.map((s, i) => (
                <li key={i}>{describeToolCall(s.name, s.input as Record<string, unknown>)}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      {e.error && <ErrorNote message={e.error} busy={busy} onRetry={() => ask(e.question, { briefing: e.briefing, retryId: e.id })} />}
    </article>
  );
}

export function LensDock() {
  const { open, setOpen, screen, exchanges, pending, ask, attention, screenApi, sheet, closeSheet, newConversation } = useLens();
  const [question, setQuestion] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const last = exchanges.at(-1);
  const lastLen = (last?.live?.text.length ?? 0) + (last?.reply ? 1 : 0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [exchanges.length, lastLen, open]);

  if (!open) {
    return (
      <div className="sticky top-14 z-20 h-[calc(100vh-3.5rem)] w-9 shrink-0 border-l border-rule bg-sheet">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open Lens${attention ? `: ${attention} thing${attention === 1 ? "" : "s"} to look at` : ""}`}
          className="flex w-full flex-col items-center gap-2 py-3 hover:bg-tint"
        >
          <Monogram />
          <span className="text-xs font-semibold [writing-mode:vertical-rl]">Lens</span>
          {attention > 0 && <span className="min-w-6 rounded-xs bg-oxblood px-1 text-center text-xs font-semibold leading-5 text-white">{attention}</span>}
        </button>
      </div>
    );
  }

  const askedHere = exchanges.some((e) => e.screen === screen && !e.briefing);
  return (
    <aside aria-label="Lens" className="panel-in sticky top-14 z-20 flex h-[calc(100vh-3.5rem)] w-[400px] shrink-0 flex-col border-l border-rule bg-sheet">
      <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
        <Monogram />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-5">Lens</h2>
          <p className="text-xs text-slate">Your procurement agent</p>
        </div>
        {exchanges.length > 0 && !sheet && (
          <button type="button" onClick={newConversation} disabled={pending} className="rounded-xs px-2 py-1 text-xs text-slate hover:bg-tint hover:text-ink">
            New conversation
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} aria-label="Collapse Lens" className="rounded-xs px-2 py-1 text-sm text-slate hover:bg-tint hover:text-ink">
          Hide
        </button>
      </div>

      {sheet ? (
        <DockSheetContext.Provider value={{ onBack: closeSheet }}>{sheet.render()}</DockSheetContext.Provider>
      ) : (
        <>
          <CiteContext.Provider value={screenApi?.cite ? { cite: screenApi.cite } : null}>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {exchanges.map((e, i) => (
                <div key={e.id} className="space-y-5">
                  {(i === 0 || exchanges[i - 1].screen !== e.screen) && (
                    <p className="flex items-center gap-2 text-xs text-slate">
                      <span className="h-px flex-1 bg-rule" />
                      On {SCREEN_NAME[e.screen]}
                      <span className="h-px flex-1 bg-rule" />
                    </p>
                  )}
                  <Message e={e} busy={pending} />
                </div>
              ))}
              {!askedHere && !pending && (
                <div>
                  <p className="text-xs font-semibold text-slate">Try asking</p>
                  <ul className="mt-1 divide-y divide-rule border-y border-rule">
                    {SUGGESTIONS[screen].map((s) => (
                      <li key={s}>
                        <button type="button" onClick={() => ask(s)} className="block w-full px-1 py-2 text-left text-sm hover:bg-tint">
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </CiteContext.Provider>
          <form
            className="border-t border-rule p-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              ask(question);
              setQuestion("");
            }}
          >
            <label htmlFor="lens-question" className="sr-only">
              Ask Lens
            </label>
            <textarea
              id="lens-question"
              value={question}
              onChange={(ev) => setQuestion(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && !ev.shiftKey) {
                  ev.preventDefault();
                  if (!pending && question.trim()) {
                    ask(question);
                    setQuestion("");
                  }
                }
              }}
              rows={2}
              placeholder={`Ask about the ${SCREEN_NAME[screen]}`}
              className={`${input} w-full resize-none`}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate">{pending ? "Lens is working" : "Every number comes from a tool and is checked."}</span>
              <button type="submit" disabled={pending || !question.trim()} className={btn.primary}>
                Ask
              </button>
            </div>
          </form>
        </>
      )}
    </aside>
  );
}
