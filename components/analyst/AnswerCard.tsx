"use client";

import Link from "next/link";
import { useContext, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { exportAnswerAction, type AnalystReply } from "@/app/(app)/comparison/analyst-actions";
import { describeToolCall } from "@/lib/ai/lens/activity";
import { btn } from "../ui/styles";
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
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children, style }) => (
            <th style={style} className="border-b border-ink px-2 py-1 text-left text-xs font-semibold text-slate">
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
          h1: ({ children }) => <p className="pt-1 text-sm font-semibold">{children}</p>,
          h2: ({ children }) => <p className="border-b border-rule pb-1 pt-2 text-sm font-semibold">{children}</p>,
          h3: ({ children }) => <p className="pt-1 font-semibold">{children}</p>,
        }}
      >
        {citationsToLinks(text)}
      </ReactMarkdown>
    </div>
  );
}

const chip = "mx-0.5 inline-block rounded-xs border border-field px-1 align-[1px] text-[11px] font-semibold leading-4 text-slate hover:border-ink hover:text-ink";

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
}: {
  question: string;
  reply: AnalystReply;
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
      {reply.nextSteps?.length > 0 && onAsk && (
        <div className="flex flex-wrap gap-2">
          {reply.nextSteps.map((s) => (
            <button key={s} type="button" disabled={busy} onClick={() => onAsk(s)} className={`${btn.small} h-auto py-1 text-left font-normal`}>
              {s}
            </button>
          ))}
        </div>
      )}
      {(reply.actions ?? []).map((a, i) => (
        <ActionCard key={i} action={a} onDone={(note) => onActionDone?.(i, note)} />
      ))}
      {reply.charts.map((c, i) => (
        <AnalystChart key={i} spec={c} />
      ))}
      {reply.exports.map((e) => (
        <a key={e.url} href={e.url} className="block text-sm underline decoration-slate underline-offset-[3px]">
          Download {e.file_name}
        </a>
      ))}
      {reply.warnings.length > 0 && (
        <p className="border-l-[3px] border-amber bg-amber-tint px-2 py-1 text-xs text-pencil">
          {reply.warnings.length} number{reply.warnings.length > 1 ? "s" : ""} not found in any tool result: {reply.warnings.map((w) => w.text).join(", ")}. Check {reply.warnings.length > 1 ? "them" : "it"} before relying on {reply.warnings.length > 1 ? "them" : "it"}.
        </p>
      )}
      {reply.tools.length > 0 && (
      <details className="group border-t border-rule pt-2 text-xs">
        <summary className="cursor-pointer font-semibold text-slate hover:text-ink">What Lens did ({reply.tools.length})</summary>
        <div className="mt-2 space-y-3">
          <ol className="list-decimal space-y-1 pl-4">
            {reply.tools.length ? reply.tools.map((t, i) => <li key={i}>{describeToolCall(t.name, t.input as Record<string, unknown>, t.error)}</li>) : <li>Answered from the conversation, without new lookups.</li>}
          </ol>
          <p className={reply.warnings.length ? "text-pencil" : "text-slate"}>
            {reply.warnings.length
              ? reply.warnings.map((w) => `${w.text} (${w.where}) was not found in any tool result.`).join(" ")
              : "Every number in the answer was found in a tool result."}
          </p>
          <dl className="flex gap-4 text-slate">
            <div>
              <dt className="inline">Time </dt>
              <dd className="inline text-ink">{reply.seconds} s</dd>
            </div>
            <div>
              <dt className="inline">Model cost </dt>
              <dd className="inline text-ink">${reply.costUsd.toFixed(3)}</dd>
            </div>
          </dl>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => exportAs("xlsx")} className={btn.small}>
              Export Excel
            </button>
            <button type="button" disabled={pending} onClick={() => exportAs("pdf")} className={btn.small}>
              Export PDF
            </button>
            {pending && <span className="self-center text-slate">Preparing the file...</span>}
          </div>
          {error && <p className="text-oxblood">{error}</p>}
        </div>
      </details>
      )}
    </div>
  );
}
