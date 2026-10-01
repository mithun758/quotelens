// A typed analyst tool: zod input and output, backed by /lib functions.
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import type { RfxDraft } from "@/lib/rfx/draft";
import type { AnalystData } from "./data";

// draft is present on the RFx screen: update_rfx_draft edits it, and the caller saves it.
export type ToolContext = { data: AnalystData; client: Db; draft?: { current: RfxDraft } };

export type AnalystTool<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  input: I;
  output: O;
  // Tools whose numbers come from the model (charts, exports) are checked, not trusted.
  modelSuppliedNumbers?: boolean;
  // Action tools never write: they return a preview card, and the change happens only
  // when Priya confirms it through the same server action the screens use.
  action?: boolean;
  run: (ctx: ToolContext, input: z.infer<I>) => Promise<z.infer<O>> | z.infer<O>;
};

export function defineTool<I extends z.ZodType, O extends z.ZodType>(tool: AnalystTool<I, O>): AnalystTool<I, O> {
  return tool;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
