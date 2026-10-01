"use client";

import type { ReactNode } from "react";
import { useLens } from "./lens/LensProvider";

// The screen's content: at most 1200px wide while Lens is closed, fluid while it is open.
export function ContentFrame({ children }: { children: ReactNode }) {
  const { open } = useLens();
  return <div className={open ? "" : "mx-auto max-w-[1200px]"}>{children}</div>;
}
