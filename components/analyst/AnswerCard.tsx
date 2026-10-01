"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { exportAnswerAction, type AnalystReply } from "@/app/(app)/comparison/analyst-actions";
import { AnalystChart } from "./AnalystChart";

function download(fileName: string, base64: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-zinc-800 [&_strong]:font-semibold [&_strong]:text-zinc-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-zinc-300 px-1.5 py-1 text-left font-medium text-zinc-600">{children}</th>,
          td: ({ children }) => <td className="border-b border-zinc-100 px-1.5 py-1 align-top">{children}</td>,
          ul: ({ children }) => <ul className="list-disc space-y-0.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-0.5 pl-5">{children}</ol>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-sky-800 underline underline-offset-2">
              {children}
            </a>
          ),
          h1: ({ children }) => <p className="font-semibold">{children}</p>,
          h2: ({ children }) => <p className="font-semibold">{children}</p>,
          h3: ({ children }) => <p className="font-semibold">{children}</p>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function AnswerCard({ question, reply }: { question: string; reply: AnalystReply }) {
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
    <div className="space-y-2">
      <Markdown text={reply.answer} />
      {reply.charts.map((c, i) => (
        <AnalystChart key={i} spec={c} />
      ))}
      {reply.exports.map((e) => (
        <a key={e.url} href={e.url} className="block text-xs text-sky-800 underline underline-offset-2">
          Download {e.file_name}
        </a>
      ))}
      {reply.warnings.length > 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          Post-check: {reply.warnings.length} number{reply.warnings.length > 1 ? "s" : ""} not found in any tool result ({reply.warnings.map((w) => w.text).join(", ")}). Treat {reply.warnings.length > 1 ? "them" : "it"} with care.
        </p>
      )}
      <details className="rounded border border-zinc-200 bg-zinc-50 text-xs">
        <summary className="cursor-pointer px-2 py-1 font-medium text-zinc-700">How I got this</summary>
        <div className="space-y-2 px-2 pb-2">
          <div>
            <p className="font-medium text-zinc-800">Basis</p>
            <ul className="list-disc pl-4 text-zinc-700">
              {reply.basis.length ? reply.basis.map((b) => <li key={b}>{b}</li>) : <li>No supplier filter or basket was applied.</li>}
            </ul>
          </div>
          <div>
            <p className="font-medium text-zinc-800">Tools called ({reply.tools.length})</p>
            <ol className="list-decimal space-y-1 pl-4">
              {reply.tools.map((t, i) => (
                <li key={i}>
                  <span className="font-mono text-zinc-900">{t.name}</span>
                  {t.error && <span className="text-red-700"> failed: {t.error}</span>}
                  <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-all rounded bg-white p-1 font-mono text-[10.5px] text-zinc-600">{JSON.stringify(t.input)}</pre>
                </li>
              ))}
            </ol>
          </div>
          <p className={reply.warnings.length ? "text-amber-900" : "text-zinc-600"}>
            Post-check:{" "}
            {reply.warnings.length
              ? reply.warnings.map((w) => `${w.text} (${w.where}) not found in any tool result`).join("; ")
              : "every number in the answer was found in a tool result."}
          </p>
          <p className="text-zinc-500">
            {reply.seconds}s · ${reply.costUsd.toFixed(3)}
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => exportAs("xlsx")} className="rounded border border-zinc-300 bg-white px-2 py-0.5 hover:bg-zinc-100 disabled:opacity-60">
              Export Excel
            </button>
            <button type="button" disabled={pending} onClick={() => exportAs("pdf")} className="rounded border border-zinc-300 bg-white px-2 py-0.5 hover:bg-zinc-100 disabled:opacity-60">
              Export PDF
            </button>
            {pending && <span className="text-zinc-500">Preparing...</span>}
          </div>
          {error && <p className="text-red-700">{error}</p>}
        </div>
      </details>
    </div>
  );
}
