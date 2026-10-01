// What the dock receives once Lens has answered: the checked answer, the tools it used,
// preview cards (with the drafted question for send_clarification), charts and exports.
import type { AnalystReply } from "@/app/(app)/comparison/analyst-actions";
import { basisNotes } from "@/lib/ai/basis";
import type { Db } from "@/lib/db/client";
import { friendlyError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";
import { draftQuestion } from "@/lib/review/decisions";
import type { ChatAction } from "@/lib/tools/actions";
import type { LensAnswer } from "./agent";

export async function toReply(client: Db, r: LensAnswer, started: number): Promise<AnalystReply> {
  // A question card shows its drafted text before Priya sends it. Drafting changes no data.
  const actions = await Promise.all(
    r.actions.map(async (a): Promise<ChatAction> => {
      if (a.kind !== "send_clarification") return a;
      try {
        await enforceRateLimit(client, "clarification");
        return { ...a, draft: await draftQuestion(client, a.supplier, a.keys) };
      } catch (error) {
        return { ...a, draft_error: friendlyError(error, "Drafting the question") };
      }
    }),
  );
  return {
    answer: r.answer,
    tools: r.toolRuns.map((t) => ({ name: t.name, input: t.input, error: t.error })),
    basis: basisNotes(r.toolRuns),
    charts: r.charts,
    exports: r.exports,
    actions,
    nextSteps: r.nextSteps,
    warnings: r.warnings,
    costUsd: r.costUsd,
    seconds: Math.round((Date.now() - started) / 1000),
  };
}
