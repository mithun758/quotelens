"use client";

import { useEffect, useRef, type ReactNode } from "react";

// A right-hand panel that pushes the content beside it (the parent grid narrows).
// Esc closes it, and focus moves to its heading when it opens.
export function SidePanel({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [title]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
