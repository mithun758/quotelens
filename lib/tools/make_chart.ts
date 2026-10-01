import { randomUUID } from "node:crypto";
import { z } from "zod";
import { defineTool } from "./define";

export const ChartSpec = z.object({
  type: z.enum(["bar", "line"]),
  title: z.string(),
  x_label: z.string().optional(),
  y_label: z.string().optional(),
  categories: z.array(z.string()).describe("x-axis labels, e.g. supplier codes or line numbers"),
  series: z.array(z.object({ name: z.string(), values: z.array(z.number()).describe("One value per category, copied from tool results") })),
});
export type ChartSpec = z.infer<typeof ChartSpec>;

export const makeChart = defineTool({
  name: "make_chart",
  description:
    "Shows a bar or line chart next to the answer. Values must be copied from earlier tool results, never computed by you; the post-check verifies them.",
  input: ChartSpec,
  output: z.object({ chart_id: z.string(), rendered: z.boolean() }),
  modelSuppliedNumbers: true,
  run(_ctx, input) {
    for (const s of input.series) {
      if (s.values.length !== input.categories.length) throw new Error(`Series ${s.name} has ${s.values.length} values for ${input.categories.length} categories`);
    }
    return { chart_id: randomUUID(), rendered: true };
  },
});
