// Small inline icons for document formats on the supplier cards.
const PATHS: Record<string, { color: string; d: string }> = {
  Excel: { color: "text-emerald-700", d: "M4 3h16v18H4zM4 9h16M4 15h16M10 3v18" },
  PDF: { color: "text-red-700", d: "M6 2h9l5 5v15H6zM14 2v6h6M9 14h6M9 18h4" },
  Word: { color: "text-blue-700", d: "M6 2h9l5 5v15H6zM14 2v6h6M8.5 12l1.5 6 2-5 2 5 1.5-6" },
  Photo: { color: "text-violet-700", d: "M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  Email: { color: "text-sky-700", d: "M3 5h18v14H3zM3 6l9 7 9-7" },
};

export function FormatIcon({ format }: { format: string }) {
  const icon = PATHS[format] ?? PATHS.PDF;
  return (
    <span className={`inline-flex items-center gap-1 ${icon.color}`}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={icon.d} />
      </svg>
      <span className="text-zinc-600">{format}</span>
    </span>
  );
}
