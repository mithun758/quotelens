"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AnalystReply } from "@/app/(app)/comparison/analyst-actions";
import type { LensScreen } from "@/lib/ai/lens/context";
import type { ViewPreview } from "@/lib/tools/actions";

// One Lens conversation across every screen, kept for the browser session. Each
// message carries the screen and what is selected on it.
export type Exchange = {
  id: string;
  screen: LensScreen;
  question: string;
  briefing?: boolean;
  reply: AnalystReply | null;
  error: string | null;
  // While streaming: the text so far, finished steps and what Lens is doing now.
  live?: { text: string; steps: { name: string; input: unknown }[]; now: string | null };
};

// What the current screen tells Lens, and what Lens can do on it.
export type ScreenApi = {
  selection: string;
  cite?: (key: string) => void;
  applyView?: (v: ViewPreview) => string;
  // Runs before Lens is asked, for example saving unsaved RFx edits.
  beforeAsk?: () => Promise<void>;
};
export type Sheet = { key: string; render: () => ReactNode };
// A sheet belongs to the screen that opened it; leaving the screen hides it.
type OpenSheet = Sheet & { screen: LensScreen };

type LensState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  screen: LensScreen;
  exchanges: Exchange[];
  pending: boolean;
  ask: (question: string, opts?: { briefing?: boolean; retryId?: string }) => void;
  markActionDone: (exchangeId: string, index: number, note: string) => void;
  newConversation: () => void;
  attention: number;
  screenApi: ScreenApi | null;
  registerScreen: (api: ScreenApi | null) => void;
  sheet: Sheet | null;
  openSheet: (sheet: Sheet) => void;
  closeSheet: () => void;
};

const LensContext = createContext<LensState | null>(null);

export function useLens(): LensState {
  const v = useContext(LensContext);
  if (!v) throw new Error("useLens outside LensProvider");
  return v;
}

// Screens register their selection, citation and view controls while mounted.
export function useLensScreen(api: ScreenApi) {
  const { registerScreen } = useLens();
  const ref = useRef(api);
  useEffect(() => {
    ref.current = api;
  });
  useEffect(() => {
    registerScreen({
      get selection() {
        return ref.current.selection;
      },
      cite: ref.current.cite ? (key) => ref.current.cite?.(key) : undefined,
      applyView: ref.current.applyView ? (v) => ref.current.applyView!(v) : undefined,
      beforeAsk: () => ref.current.beforeAsk?.() ?? Promise.resolve(),
    });
    return () => registerScreen(null);
  }, [registerScreen]);
}

export const LENS_KEYS = { conversation: "quotelens.lens.v1", briefed: "quotelens.lens.briefed.v1", open: "quotelens.lens.open" };

const screenOf = (path: string): LensScreen =>
  path.startsWith("/rfx") ? "rfx" : path.startsWith("/quotes") ? "quotes" : path.startsWith("/award") ? "award" : path.startsWith("/eval") ? "eval" : "comparison";

function read<T>(storage: () => Storage, key: string, fallback: T): T {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(storage: () => Storage, key: string, value: unknown) {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); Lens still works in memory.
  }
}

const BRIEFING = (screen: LensScreen) =>
  `Priya has just arrived on the ${{ rfx: "RFx", quotes: "Quotes", comparison: "Quote Comparison", award: "Award", eval: "Eval" }[screen]} screen and has not typed anything. Brief her: under 60 words, then two or three suggested next steps.`;

export function LensProvider({ attentionByScreen, children }: { attentionByScreen: Partial<Record<LensScreen, number>>; children: ReactNode }) {
  const router = useRouter();
  const screen = screenOf(usePathname());
  const [open, setOpenState] = useState(true);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [briefed, setBriefed] = useState<LensScreen[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(false);
  const [screenApi, setScreenApi] = useState<ScreenApi | null>(null);
  const [openSheetState, setSheet] = useState<OpenSheet | null>(null);
  const sheet = openSheetState && openSheetState.screen === screen ? openSheetState : null;
  const exchangesRef = useRef(exchanges);
  exchangesRef.current = exchanges;

  // Restore after mount, so the server render and the first client render match.
  useEffect(() => {
    // Saved state lives in browser storage, which the server render cannot read.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore once after mount
    setOpenState(read(() => localStorage, LENS_KEYS.open, true));
    setExchanges(read<Exchange[]>(() => sessionStorage, LENS_KEYS.conversation, []).filter((e) => e.reply || e.error));
    setBriefed(read<LensScreen[]>(() => sessionStorage, LENS_KEYS.briefed, []));
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) write(() => sessionStorage, LENS_KEYS.conversation, exchanges.filter((e) => !e.live));
  }, [exchanges, hydrated]);
  useEffect(() => {
    if (hydrated) write(() => sessionStorage, LENS_KEYS.briefed, briefed);
  }, [briefed, hydrated]);

  // Reset demo clears the conversation and the briefing memory.
  useEffect(() => {
    const onReset = () => {
      setExchanges([]);
      setBriefed([]);
      setSheet(null);
    };
    window.addEventListener("quotelens:reset", onReset);
    return () => window.removeEventListener("quotelens:reset", onReset);
  }, []);

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    write(() => localStorage, LENS_KEYS.open, v);
  }, []);

  const patch = (id: string, fn: (e: Exchange) => Exchange) => setExchanges((xs) => xs.map((e) => (e.id === id ? fn(e) : e)));

  const ask = useCallback(
    (question: string, opts: { briefing?: boolean; retryId?: string } = {}) => {
      const text = question.trim();
      if (!text || pending) return;
      const base = opts.retryId ? exchangesRef.current.filter((e) => e.id !== opts.retryId) : exchangesRef.current;
      const history = base
        .filter((e) => e.reply)
        .slice(-6)
        .flatMap((e) => [
          { role: "user" as const, content: e.briefing ? `(Priya opened the ${e.screen} screen)` : e.question },
          { role: "assistant" as const, content: e.reply!.answer, tools: e.reply!.tools.map((t) => t.name) },
        ]);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const ui = { screen, selection: screenApi?.selection || "none", briefing: !!opts.briefing };
      setExchanges([...base, { id, screen, question: text, briefing: opts.briefing, reply: null, error: null, live: { text: "", steps: [], now: null } }]);
      setPending(true);
      (async () => {
        try {
          await screenApi?.beforeAsk?.();
          const res = await fetch("/api/lens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text, history, ui }) });
          if (!res.ok || !res.body) {
            const body = await res.json().catch(() => ({ error: "Lens could not answer. Try again." }));
            patch(id, (e) => ({ ...e, live: undefined, error: body.error ?? "Lens could not answer. Try again." }));
            if (opts.briefing) setBriefed((b) => (b.includes(ui.screen) ? b : [...b, ui.screen]));
            return;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";
            for (const raw of events) {
              const line = raw.split("\n").find((l) => l.startsWith("data: "));
              if (!line) continue;
              const ev = JSON.parse(line.slice(6));
              if (ev.type === "text") patch(id, (e) => ({ ...e, live: { ...e.live!, text: e.live!.text + ev.delta } }));
              else if (ev.type === "tool_start") patch(id, (e) => ({ ...e, live: { ...e.live!, now: ev.name } }));
              else if (ev.type === "tool_done") patch(id, (e) => ({ ...e, live: { ...e.live!, now: null, steps: [...e.live!.steps, { name: ev.name, input: ev.input }] } }));
              // A round that ends in tool calls was Lens thinking aloud; the answer comes later.
              else if (ev.type === "round_end") patch(id, (e) => ({ ...e, live: { ...e.live!, text: "" } }));
              else if (ev.type === "done") {
                const reply = ev.reply as AnalystReply & { draftChanged?: boolean };
                const actions = reply.actions.map((a) => (a.kind === "set_view" && screenApi?.applyView ? { ...a, status: "done" as const, done_note: `Comparison switched to ${screenApi.applyView(a)}.` } : a));
                patch(id, (e) => ({ ...e, live: undefined, reply: { ...reply, actions } }));
                if (opts.briefing) setBriefed((b) => (b.includes(ui.screen) ? b : [...b, ui.screen]));
                if (reply.draftChanged) router.refresh();
              } else if (ev.type === "error") {
                patch(id, (e) => ({ ...e, live: undefined, error: ev.error }));
                // A failed briefing offers Retry rather than trying again by itself.
                if (opts.briefing) setBriefed((b) => (b.includes(ui.screen) ? b : [...b, ui.screen]));
              }
            }
          }
        } catch {
          patch(id, (e) => ({ ...e, live: undefined, error: "The connection dropped. Check it and try again." }));
        } finally {
          setPending(false);
        }
      })();
    },
    [pending, screen, screenApi, router],
  );

  // Brief Priya on first arrival at each screen, while the dock is open. A screen counts
  // as briefed only once its briefing arrives, so a reload mid-briefing tries again.
  useEffect(() => {
    if (!hydrated || !open || pending || briefed.includes(screen)) return;
    const t = setTimeout(() => ask(BRIEFING(screen), { briefing: true }), 400);
    return () => clearTimeout(t);
  }, [hydrated, open, pending, briefed, screen, ask]);

  const markActionDone = useCallback((exchangeId: string, index: number, note: string) => {
    setExchanges((xs) => xs.map((e) => (e.id === exchangeId && e.reply ? { ...e, reply: { ...e.reply, actions: e.reply.actions.map((a, j) => (j === index ? { ...a, status: "done" as const, done_note: note } : a)) } } : e)));
  }, []);

  const pendingCards = exchanges.reduce((n, e) => n + (e.reply?.actions.filter((a) => a.kind !== "set_view" && !a.status).length ?? 0), 0);
  const value = useMemo<LensState>(
    () => ({
      open,
      setOpen,
      screen,
      exchanges,
      pending,
      ask,
      markActionDone,
      newConversation: () => setExchanges([]),
      attention: (attentionByScreen[screen] ?? 0) + pendingCards,
      screenApi,
      registerScreen: setScreenApi,
      sheet,
      openSheet: (s) => {
        setSheet({ ...s, screen });
        setOpen(true);
      },
      closeSheet: () => setSheet(null),
    }),
    [open, setOpen, screen, exchanges, pending, ask, markActionDone, attentionByScreen, pendingCards, screenApi, sheet],
  );
  return <LensContext.Provider value={value}>{children}</LensContext.Provider>;
}
