"use client";

import { ArrowLeft } from "lucide-react";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

// Inside the Lens dock, a panel shows as a sheet with "Back to Lens" instead of
// pushing in as its own column.
export const DockSheetContext = createContext<{ onBack: () => void } | null>(null);

// A right-hand panel that pushes the content beside it (the parent grid narrows).
// Esc closes it, and focus moves to its heading when it opens.
export function SidePanel({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const sheet = useContext(DockSheetContext);
  const close = sheet?.onBack ?? onClose;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [title]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  if (sheet) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-rule px-4 py-3">
          <button type="button" onClick={close} className="-ml-1 inline-flex items-center gap-1 rounded-xs px-1 text-meta font-semibold text-slate hover:bg-tint hover:text-ink">
            <ArrowLeft aria-hidden className="size-3.5 stroke-[1.5]" />
            Back to Lens
          </button>
          <h3 ref={headingRef} tabIndex={-1} className="mt-1 text-heading font-semibold outline-none">
            {title}
          </h3>
          {subtitle && <div className="text-meta text-slate">{subtitle}</div>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="border-t border-rule px-4 py-3">{footer}</div>}
      </div>
    );
  }

  return (
    <aside aria-label={title} className="panel-in sticky top-[4.75rem] flex h-[calc(100vh-6rem)] min-h-0 flex-col rounded-xs border border-rule bg-sheet shadow-[0_8px_24px_rgb(27_42_65/0.10)]">
      <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="min-w-0">
          <h3 ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-none">
            {title}
          </h3>
          {subtitle && <div className="text-xs text-slate">{subtitle}</div>}
        </div>
        <button type="button" onClick={onClose} className="rounded-xs px-2 py-1 text-sm text-slate hover:bg-tint hover:text-ink">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
      {footer && <div className="border-t border-rule px-4 py-3">{footer}</div>}
    </aside>
  );
}
