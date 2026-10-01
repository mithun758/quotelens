import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Our type scale (text-meta, text-table...) is font size, not colour, so later
// size classes replace earlier ones and colours survive.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["display", "title", "heading", "body", "table", "meta"] } },
});

// Joins class names and lets later Tailwind classes win, for the shadcn components.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
