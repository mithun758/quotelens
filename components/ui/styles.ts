// Three button styles, used the same way on every screen.
const base = "inline-flex items-center justify-center gap-1.5 rounded-xs text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
export const btn = {
  primary: `${base} bg-ink px-3 py-1.5 text-white hover:bg-[#2a3d5a]`,
  secondary: `${base} border border-field bg-sheet px-3 py-1.5 text-ink hover:bg-tint`,
  small: `${base} border border-field bg-sheet px-2 py-0.5 text-xs text-ink hover:bg-tint`,
  smallPrimary: `${base} bg-ink px-2 py-0.5 text-xs text-white hover:bg-[#2a3d5a]`,
  quiet: "rounded-xs text-sm font-semibold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink disabled:opacity-45",
};
export const input = "rounded-xs border border-field bg-sheet px-2 py-1.5 text-sm text-ink placeholder:text-slate";
export const sectionTitle = "text-base font-semibold";
export const caption = "text-xs text-slate";
