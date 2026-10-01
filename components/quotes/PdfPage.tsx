"use client";

import { useEffect, useRef, useState } from "react";

type Box = [number, number, number, number];

type TextItem = { str: string; transform: number[]; width: number; height: number };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Finds the snippet in the page's text layer: the text line with the most matched
// characters wins. Exact, unlike the model's estimated box, which is the fallback.
function locateSnippet(items: TextItem[], snippet: string, toFraction: (x0: number, y0: number, x1: number, y1: number) => Box): Box | null {
  const needle = norm(snippet);
  if (needle.length < 3) return null;
  const lines = new Map<number, { score: number; items: TextItem[] }>();
  for (const it of items) {
    const text = norm(it.str);
    if (text.length < 2 || !needle.includes(text)) continue;
    const y = Math.round(it.transform[5] / 2) * 2;
    const line = lines.get(y) ?? { score: 0, items: [] };
    line.score += text.length;
    line.items.push(it);
    lines.set(y, line);
  }
  const best = [...lines.values()].sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < Math.min(12, needle.length * 0.4)) return null;
  const xs = best.items.flatMap((it) => [it.transform[4], it.transform[4] + it.width]);
  const ys = best.items.flatMap((it) => [it.transform[5], it.transform[5] + (it.height || Math.abs(it.transform[3]))]);
  return toFraction(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
}

// Renders one PDF page with pdf.js and draws the source box over it.
export function PdfPage({ url, page, bbox, snippet }: { url: string; page: number; bbox: Box | null; snippet: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exact, setExact] = useState<{ key: string; box: Box | null } | null>(null);
  const key = `${url}|${page}|${snippet ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const pdf = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);
        const p = await pdf.getPage(Math.min(Math.max(page, 1), pdf.numPages));
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const viewport = p.getViewport({ scale: 1.6 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await p.render({ canvas, viewport }).promise;
        if (snippet) {
          const content = await p.getTextContent();
          const box = locateSnippet(content.items as TextItem[], snippet, (x0, y0, x1, y1) => {
            const p0 = [x0, y0];
            const p1 = [x1, y1];
            pdfjs.Util.applyTransform(p0, viewport.transform);
            pdfjs.Util.applyTransform(p1, viewport.transform);
            const [a, b, c, d] = [p0[0], p0[1], p1[0], p1[1]];
            return [Math.min(a, c) / viewport.width, Math.min(b, d) / viewport.height, Math.max(a, c) / viewport.width, Math.max(b, d) / viewport.height];
          });
          if (!cancelled) setExact({ key: `${url}|${page}|${snippet}`, box });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not render the PDF");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, page, snippet]);

  const shown = exact?.key === key && exact.box ? exact.box : bbox;

  if (error) return <p className="p-3 text-sm text-red-700">{error}</p>;
  return (
    <div>
      {pageCount && pageCount > 1 && <p className="mb-1 text-xs text-zinc-500">Page {page} of {pageCount}</p>}
      <div className="relative">
        <canvas ref={canvasRef} className="h-auto w-full" />
        {shown && <Highlight bbox={shown} />}
      </div>
    </div>
  );
}

export function Highlight({ bbox }: { bbox: Box }) {
  const [x0, y0, x1, y1] = bbox;
  const pad = 0.006;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-sm border-2 border-amber-500 bg-amber-300/25"
      style={{
        left: `${(x0 - pad) * 100}%`,
        top: `${(y0 - pad) * 100}%`,
        width: `${(x1 - x0 + 2 * pad) * 100}%`,
        height: `${(y1 - y0 + 2 * pad) * 100}%`,
      }}
    />
  );
}
