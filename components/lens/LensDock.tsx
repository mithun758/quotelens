"use client";

import { MessageSquarePlus, PanelRightClose } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import type { LensScreen } from "@/lib/ai/lens/context";
import { activityNow, describeToolCall } from "@/lib/ai/lens/activity";
import { Conversation, ConversationContent, ConversationScrollButton } from "../ai-elements/conversation";
import { Loader } from "../ai-elements/loader";
import { Message, MessageLabel } from "../ai-elements/message";
import { PromptInput } from "../ai-elements/prompt-input";
import { Suggestion, Suggestions } from "../ai-elements/suggestion";
import { Task, TaskContent, TaskItem, TaskTrigger } from "../ai-elements/task";
import { AnswerCard, Markdown } from "../analyst/AnswerCard";
import { CiteContext } from "../analyst/cite";
import { ErrorNote } from "../ErrorNote";
import { Button } from "../ui/button";
import { DockSheetContext } from "../ui/SidePanel";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useLens, type Exchange } from "./LensProvider";
import { toolIcon } from "./toolIcon";

const SCREEN_NAME: Record<LensScreen, string> = { rfx: "RFx", quotes: "Quotes", comparison: "Comparison", award: "Award", eval: "Evaluation" };

// Suggested prompts for the current screen, shown while the conversation here is idle.
const SUGGESTIONS: Record<LensScreen, string[]> = {
  rfx: ["We need 60 business laptops for the labs.", "Check this draft before I send it.", "Is the quote validity long enough for approval?"],
  quotes: ["What needs me first?", "Accept all of Prakash's GST ones.", "Ask Lionbridge about the lines it didn't quote."],
  comparison: ["Who is cheapest on a like-for-like basis?", "Are any of those quotes stale or at risk before approval?", "Show me the decision-ready prices."],
  award: ["What must I resolve before I can send this award to Meera?", "Compare Best Quote with the incumbent.", "Ask Sri Ganesh to reconfirm its prices."],
  eval: ["What do these accuracy figures measure?", "Which extraction errors remain?"],
};

const WIDTH = { open: 400, closed: 32 };

function Monogram() {
  return (
    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-xs bg-ink text-meta font-semibold text-white">
      L
    </span>
  );
}

function Turn({ e, busy }: { e: Exchange; busy: boolean }) {
  const { ask, markActionDone } = useLens();
  const answer = e.reply && (
    <AnswerCard question={e.question} reply={e.reply} busy={busy} stepMs={e.stepMs} onAsk={(q) => ask(q)} onActionDone={(i, note) => markActionDone(e.id, i, note)} />
  );
  return (
    <article className="space-y-3">
      {e.briefing ? (
        <Message from="briefing">
          <MessageLabel>Briefing</MessageLabel>
          {answer}
          {e.live && <Live e={e} />}
        </Message>
      ) : (
        <>
          <Message from="user">{e.question}</Message>
          {(answer || e.live) && (
            <Message from="assistant">
              {answer}
              {e.live && <Live e={e} />}
            </Message>
          )}
        </>
      )}
      {e.error && <ErrorNote message={e.error} busy={busy} onRetry={() => ask(e.question, { briefing: e.briefing, retryId: e.id })} />}
    </article>
  );
}

// While Lens works: the text so far, what it is doing now, and the steps done.
function Live({ e }: { e: Exchange }) {
  const live = e.live!;
  return (
    <div aria-live="polite" className="space-y-2">
      {live.text ? <Markdown text={live.text} /> : null}
      <p className="flex items-center gap-2 text-meta text-slate">
        <Loader />
        {live.now ? `${activityNow(live.now)}…` : live.text ? "Writing…" : e.briefing ? "Looking over this screen…" : "Reading your question…"}
      </p>
      {live.steps.length > 0 && (
        <Task>
          <TaskTrigger title={`What Lens did so far (${live.steps.length})`} />
          <TaskContent>
            {live.steps.map((s, i) => {
              const Icon = toolIcon(s.name);
              return (
                <TaskItem key={i}>
                  <Icon aria-hidden />
                  <span className="flex-1">{describeToolCall(s.name, s.input as Record<string, unknown>)}</span>
                  {s.ms ? <span className="text-slate">{(s.ms / 1000).toFixed(1)} s</span> : null}
                </TaskItem>
              );
            })}
          </TaskContent>
        </Task>
      )}
    </div>
  );
}

export function LensDock() {
  const { open, setOpen, screen, exchanges, pending, ask, attention, screenApi, sheet, closeSheet, newConversation } = useLens();
  const lastHere = [...exchanges].reverse().find((e) => e.screen === screen);
  const idle = !pending && (!lastHere || lastHere.briefing || !!lastHere.reply);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={false}
        animate={{ width: open ? WIDTH.open : WIDTH.closed }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="sticky top-14 z-20 h-[calc(100vh-3.5rem)] shrink-0 overflow-hidden border-l border-rule bg-sheet"
        style={{ width: open ? WIDTH.open : WIDTH.closed }}
      >
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Open Lens${attention ? `: ${attention} thing${attention === 1 ? "" : "s"} to look at` : ""}`}
            title="Open Lens (⌘J)"
            className="flex h-full w-8 flex-col items-center gap-2 py-3 hover:bg-tint"
          >
            <Monogram />
            <span className="text-meta font-semibold [writing-mode:vertical-rl]">Lens</span>
            {/* Oxblood when the count is award blockers, ink for other things to look at. */}
            {attention > 0 && (
              <span className={`min-w-5 rounded-full px-1 text-center text-meta leading-5 font-semibold text-white ${screen === "award" ? "bg-oxblood" : "bg-ink"}`}>{attention}</span>
            )}
          </button>
        ) : (
          <aside aria-label="Lens" className="flex h-full w-[400px] flex-col">
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-rule px-4">
              <Monogram />
              <div className="min-w-0 flex-1">
                <h2 className="text-body leading-5 font-semibold">Lens</h2>
                <p className="text-meta text-slate">Your procurement agent</p>
              </div>
              {exchanges.length > 0 && !sheet && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={newConversation} disabled={pending} aria-label="New conversation">
                      <MessageSquarePlus aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New conversation</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Collapse Lens">
                    <PanelRightClose aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Collapse Lens (⌘J)</TooltipContent>
              </Tooltip>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col">
              <CiteContext.Provider value={screenApi?.cite ? { cite: screenApi.cite } : null}>
                <Conversation>
                  <ConversationContent>
                    {exchanges.length === 0 && !pending && <p className="text-meta text-slate">Ask about this event in plain language. Every number Lens gives comes from a tool and is checked.</p>}
                    {exchanges.map((e, i) => (
                      <div key={e.id} className="space-y-4">
                        {(i === 0 || exchanges[i - 1].screen !== e.screen) && (
                          <p className="flex items-center gap-3 text-meta text-slate">
                            <span className="h-px flex-1 bg-rule" />
                            On {SCREEN_NAME[e.screen]}
                            <span className="h-px flex-1 bg-rule" />
                          </p>
                        )}
                        <Turn e={e} busy={pending} />
                      </div>
                    ))}
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>
              </CiteContext.Provider>

              <div className="shrink-0 space-y-3 border-t border-rule p-4">
                {idle && (
                  <Suggestions aria-label="Suggested questions">
                    {SUGGESTIONS[screen].map((s) => (
                      <Suggestion key={s} suggestion={s} onClick={(q) => ask(q)} />
                    ))}
                  </Suggestions>
                )}
                <PromptInput onSubmit={(q) => ask(q)} disabled={pending} placeholder="Ask Lens about this event" />
              </div>

              {sheet && (
                <motion.div
                  key={sheet.key}
                  initial={{ x: 24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute inset-0 z-10 flex flex-col bg-sheet"
                >
                  <DockSheetContext.Provider value={{ onBack: closeSheet }}>{sheet.render()}</DockSheetContext.Provider>
                </motion.div>
              )}
            </div>
          </aside>
        )}
      </motion.div>
    </MotionConfig>
  );
}
