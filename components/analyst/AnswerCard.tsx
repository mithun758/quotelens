"use client";

import Link from "next/link";
import { useContext, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { exportAnswerAction, type AnalystReply } from "@/app/(app)/comparison/analyst-actions";
import { Download } from "lucide-react";
import { describeToolCall } from "@/lib/ai/lens/activity";
import { inlineCitation } from "../ai-elements/inline-citation";
import { Suggestion, Suggestions } from "../ai-elements/suggestion";
import { Task, TaskContent, TaskItem, TaskTrigger } from "../ai-elements/task";
import { toolIcon } from "../lens/toolIcon";
import { Button } from "../ui/button";
import { ActionCard } from "./ActionCards";
import { AnalystChart } from "./AnalystChart";
import { CiteContext, citationsToLinks, parseDocHref } from "./cite";

function download(fileName: string, base64: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// Markdown in the house style: answers and the memo use the same ruled tables as
// the comparison, with right-aligned tabular figures.
export function Markdown({ text, size = "sm" }: { text: string; size?: "sm" | "doc" }) {
  return (
    <div className={`space-y-2 ${size === "doc" ? "text-[13px] leading-[19px]" : "text-sm leading-5"} [&_strong]:font-semibold`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className={`w-full border-collapse ${size === "doc" ? "text-table" : "text-meta"}`}>{children}</table>
            </div>
          ),
          th: ({ children, style }) => (
            <th style={style} className="border-b-2 border-rule-strong px-2 py-1.5 text-left text-meta font-semibold text-slate">
              {children}
            </th>
          ),
          td: ({ children, style }) => (
            <td style={style} className="h-8 border-b border-rule px-2 py-1 align-top">
              {children}
            </td>
          ),
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          a: ({ children, href }) => <CitationOrLink href={href ?? ""}>{children}</CitationOrLink>,
          h1: ({ children }) => <p className={`pt-1 font-semibold ${size === "doc" ? "text-heading" : "text-body"}`}>{children}</p>,
          h2: ({ children }) => <p className={`border-b border-rule pt-3 pb-1 font-semibold ${size === "doc" ? "text-heading" : "text-body"}`}>{children}</p>,
          h3: ({ children }) => <p className="pt-1 font-semibold">{children}</p>,
        }}
      >
        {citationsToLinks(text)}
      </ReactMarkdown>
    </div>
  );
}

const chip = inlineCitation;

// Lens citations: a cell chip highlights the comparison cell; a source chip opens the
// document at the cited place. Other links open normally.
function CitationOrLink({ href, children }: { href: string; children: React.ReactNode }) {
  const citer = useContext(CiteContext);
  const cell = href.match(/^#cite-cell-([A-Z])-(\d+)$/);
  if (cell) {
    const label = `Supplier ${cell[1]}, line ${cell[2]}: show the cell`;
    return citer ? (
      <button type="button" onClick={() => citer.cite(`${cell[1]}:${cell[2]}`)} title={label} aria-label={label} className={chip}>
        {children}
      </button>
    ) : (
      <Link href={`/comparison?cell=${cell[1]}-${cell[2]}`} title={label} aria-label={label} className={chip}>
        {children}
      </Link>
    );
  }
  const doc = parseDocHref(href);
  if (doc) {
    return (
      <Link href={`/quotes?doc=${doc.id}&loc=${encodeURIComponent(doc.loc)}#exceptions`} title="Open the source document at this place" className={chip}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline decoration-slate underline-offset-[3px] hover:decoration-ink">
      {children}
    </a>
  );
}

export function AnswerCard({
  question,
  reply,
  onActionDone,
  onAsk,
  busy = false,
  stepMs,
}: {
  question: string;
  reply: AnalystReply;
  // How long each step took, when measured while streaming.
  stepMs?: number[];
  onActionDone?: (index: number, note: string) => void;
  // Asks a suggested next step as a question.
  onAsk?: (q: string) => void;
  busy?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const exportAs = (format: "xlsx" | "pdf") =>
    startTransition(async () => {
      setError(null);
      const r = await exportAnswerAction({ format, question, reply });
      if (r.ok) download(r.fileName, r.base64, r.mime);
      else setError(r.error);
    });

  return (
    <div className="space-y-3">
      <Markdown text={reply.answer} />
      {reply.warnings.length > 0 && <WarningNote warnings={reply.warnings} />}
      {(reply.actions ?? []).map((a, i) => (
        <ActionCard key={i} action={a} onDone={(note) => onActionDone?.(i, note)} />
      ))}
      {reply.charts.map((c, i) => (
        <AnalystChart key={i} spec={c} />
      ))}
      {reply.exports.map((e) => (
        <a key={e.url} href={e.url} className="flex items-center gap-1.5 text-body underline decoration-slate underline-offset-[3px]">
          <Download aria-hidden className="size-4 stroke-[1.5] text-slate" />
          Download {e.file_name}
        </a>
      ))}
      {reply.nextSteps?.length > 0 && onAsk && (
        <Suggestions>
          {reply.nextSteps.map((s) => (
            <Suggestion key={s} suggestion={s} disabled={busy} onClick={onAsk} />
          ))}
        </Suggestions>
      )}
      {reply.tools.length > 0 && (
        <Task>
          <TaskTrigger title={`What Lens did (${reply.tools.length})`} />
          <TaskContent>
            {reply.tools.map((t, i) => {
              const Icon = toolIcon(t.name);
              return (
                <TaskItem key={i}>
                  <Icon aria-hidden />
                  <span className="flex-1">{describeToolCall(t.name, t.input as Record<string, unknown>, t.error)}</span>
                  {stepMs?.[i] ? <span className="shrink-0 text-slate">{(stepMs[i] / 1000).toFixed(1)} s</span> : null}
                </TaskItem>
              );
            })}
            <p className={`pt-1 text-meta ${reply.warnings.length ? "text-pencil" : "text-slate"}`}>
              {reply.warnings.length ? `${reply.warnings.length} item${reply.warnings.length > 1 ? "s" : ""} flagged by the checks; see the note above.` : "Every number in the answer was found in a tool result."}
            </p>
            <p className="text-meta text-slate">
              {reply.seconds} s, model cost ${reply.costUsd.toFixed(3)}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => exportAs("xlsx")}>
                Export Excel
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => exportAs("pdf")}>
                Export PDF
              </Button>
              {pending && <span className="text-meta text-slate">Preparing the file...</span>}
            </div>
            {error && <p className="text-meta text-oxblood">{error}</p>}
          </TaskContent>
        </Task>
      )}
    </div>
  );
}

// The number and citation checks, in words: unsourced figures to check, and citations
// that were removed because they pointed at the wrong place.
function WarningNote({ warnings }: { warnings: AnalystReply["warnings"] }) {
  const numbers = warnings.filter((w) => !w.text.startsWith("[["));
  const citations = warnings.filter((w) => w.text.startsWith("[["));
  const cellName = (t: string) => t.match(/^\[\[cell:([A-Z]):(\d+)\]\]$/)?.slice(1).join("") ?? "a source";
  return (
    <div className="space-y-1 rounded-xs border-l-2 border-amber bg-amber-tint px-2 py-1 text-meta text-pencil">
      {numbers.length > 0 && (
        <p>
          {numbers.length} number{numbers.length > 1 ? "s" : ""} not found in any tool result: {numbers.map((w) => w.text).join(", ")}. Check {numbers.length > 1 ? "them" : "it"} before relying on {numbers.length > 1 ? "them" : "it"}.
        </p>
      )}
      {citations.length > 0 && (
        <p>
          {citations.length === 1 ? "A citation" : `${citations.length} citations`} ({citations.map((w) => cellName(w.text)).join(", ")}) did not match the figure beside {citations.length === 1 ? "it" : "them"} and {citations.length === 1 ? "was" : "were"} removed.
        </p>
      )}
    </div>
  );
}
