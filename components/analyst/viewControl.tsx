"use client";

import { createContext } from "react";
import type { ViewPreview } from "@/lib/tools/actions";

// Lets an analyst answer switch what the Quote Comparison shows (set_view). Display only.
export type ViewControl = { apply: (v: ViewPreview) => string };
export const ViewControlContext = createContext<ViewControl | null>(null);
