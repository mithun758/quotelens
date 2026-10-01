"use client";

import { createContext } from "react";

// Lens cites a comparison cell as [[cell:B:17]]. On the Quote Comparison, clicking the
// citation scrolls to that cell and highlights it; elsewhere it links there.
export type Citer = { cite: (key: string) => void };
export const CiteContext = createContext<Citer | null>(null);

// Citations become markdown links with a recognisable fragment, so the renderer can
// turn them into buttons. Document locators are URL-encoded to survive the link.

export function citationsToLinks(text: string): string {
  return text
    .replace(/\[\[cell:([A-Z]):(\d{1,3})\]\]/g, (_m, s: string, n: string) => `[${s}${n}](#cite-cell-${s}-${n})`)
    .replace(/\[\[doc:([0-9a-f-]{36}):([^\]]*)\]\]/g, (_m, id: string, loc: string) => `[source](#cite-doc-${id}-${encodeURIComponent(loc)})`);
}

// "#cite-doc-<36-char id>-<encoded locator>" back to its parts.
export function parseDocHref(href: string): { id: string; loc: string } | null {
  const m = href.match(/^#cite-doc-([0-9a-f-]{36})-(.*)$/);
  return m ? { id: m[1], loc: decodeURIComponent(m[2]) } : null;
}
