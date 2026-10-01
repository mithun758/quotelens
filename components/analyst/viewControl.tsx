"use client";

import { createContext } from "react";
import type { LensScreen } from "@/lib/ai/lens/context";
import type { ViewPreview } from "@/lib/tools/actions";

// Lets an analyst answer switch what the Quote Comparison shows (set_view). Display only.
export type ViewControl = { apply: (v: ViewPreview) => string };
export const ViewControlContext = createContext<ViewControl | null>(null);

// Where Lens is being asked from: the screen and what Priya has selected on it.
export type LensUiState = { screen: LensScreen; selection: string };
export const LensUiContext = createContext<LensUiState>({ screen: "comparison", selection: "none" });
