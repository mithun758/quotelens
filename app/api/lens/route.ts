import { runLens, type LensEvent, type LensTurn } from "@/lib/ai/lens/agent";
import { LENS_SCREENS, type LensUi } from "@/lib/ai/lens/context";
import { toReply } from "@/lib/ai/lens/reply";
import { hasValidSession } from "@/lib/auth/gate";
import { db } from "@/lib/db/client";
import { recordAuditEvent } from "@/lib/db/queries";
import { UserFacingError, friendlyError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";
import { getDraft, saveDraft } from "@/lib/rfx/store";

// Lens in the dock, on every screen. Streams server-sent events: text as it arrives,
// each tool step, and the checked reply at the end. A route handler, so the answer
// can stream and the page's server actions stay free.
export const maxDuration = 300;

type Body = { message?: unknown; history?: unknown; ui?: Partial<LensUi> };

export async function POST(req: Request) {
  if (!(await hasValidSession())) return Response.json({ error: "Passcode required" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Body;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) return Response.json({ error: "Ask a question." }, { status: 400 });
  const screen = body.ui?.screen;
  if (!screen || !LENS_SCREENS.includes(screen)) return Response.json({ error: "Unknown screen." }, { status: 400 });
  const ui: LensUi = { screen, selection: String(body.ui?.selection ?? "none").slice(0, 300), briefing: !!body.ui?.briefing };
  const history: LensTurn[] = (Array.isArray(body.history) ? body.history : [])
    .slice(-12)
    .filter((t): t is LensTurn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .map((t) => ({ role: t.role, content: t.content.slice(0, 8000), tools: Array.isArray(t.tools) ? t.tools.map(String).slice(0, 20) : undefined }));

  const client = db();
  try {
    await enforceRateLimit(client, "analyst");
  } catch (error) {
    return Response.json({ error: friendlyError(error, "Lens") }, { status: error instanceof UserFacingError ? 429 : 502 });
  }

  const started = Date.now();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        // On the RFx screen Lens edits the draft; a sent RFx is read-only.
        const state = ui.screen === "rfx" ? await getDraft(client) : null;
        const draft = state && state.status !== "sent" ? state.draft : null;
        const r = await runLens(client, { ui, message, history, draft, onEvent: (e: LensEvent) => send(e) });
        let draftChanged = false;
        if (draft && r.draft && JSON.stringify(r.draft) !== JSON.stringify(draft)) {
          await saveDraft(client, r.draft);
          draftChanged = true;
          await recordAuditEvent({ actor: "model", action: "update_rfx_draft", target: r.draft.title || "rfx draft", after: { tools: r.toolRuns.map((t) => t.name), lines: r.draft.lines.length } }, client);
        }
        await recordAuditEvent({ actor: "priya", action: ui.briefing ? "lens_briefing" : "ask_lens", target: ui.screen, after: { question: ui.briefing ? null : message, tools: r.toolRuns.map((t) => t.name), warnings: r.warnings.length } }, client);
        send({ type: "done", reply: { ...(await toReply(client, r, started)), draftChanged } });
      } catch (error) {
        send({ type: "error", error: friendlyError(error, "Lens") });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}
