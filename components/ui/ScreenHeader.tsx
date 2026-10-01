import type { ReactNode } from "react";

// Every screen's title row: title, one line on what it is for, actions on the right.
export function ScreenHeader({ title, description, actions }: { title: string; description: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-title font-semibold">{title}</h1>
        <p className="text-body text-slate">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// A section heading with its one-line description and optional actions.
export function SectionHeader({ id, title, description, actions }: { id?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-heading font-semibold">
          {title}
        </h2>
        {description && <p className="text-meta text-slate">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
