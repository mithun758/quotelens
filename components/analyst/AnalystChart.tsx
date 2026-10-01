"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartSpec } from "@/lib/tools/make_chart";

// Validated categorical palette (light steps), assigned in fixed order, never cycled.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const INK = { primary: "#1b2a41", secondary: "#5b6676", grid: "#d9dcd6" };

const fmt = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function AnalystChart({ spec }: { spec: ChartSpec }) {
  const [asTable, setAsTable] = useState(false);
  const series = spec.series.slice(0, SERIES.length);
  const rows = spec.categories.map((c, i) => ({ category: c, ...Object.fromEntries(series.map((s) => [s.name, s.values[i]])) }));
  const multi = series.length > 1;

  return (
    <figure className="border-y border-rule py-2">
      <figcaption className="mb-1 flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-semibold">{spec.title}</span>
        <button type="button" onClick={() => setAsTable(!asTable)} className="text-xs text-slate underline decoration-rule underline-offset-2 hover:text-ink">
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </figcaption>
      {asTable ? (
        <table className="w-full text-xs">
          <thead className="text-slate">
            <tr>
              <th className="px-1 py-0.5 text-left font-medium">{spec.x_label ?? ""}</th>
              {series.map((s) => (
                <th key={s.name} className="px-1 py-0.5 text-right font-medium">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category} className="border-t border-rule">
                <td className="px-1 py-0.5">{r.category}</td>
                {series.map((s) => (
                  <td key={s.name} className="px-1 py-0.5 text-right">
                    {fmt((r as unknown as Record<string, number>)[s.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="h-56 w-full" role="img" aria-label={`${spec.type} chart: ${spec.title}`}>
          <ResponsiveContainer width="100%" height="100%">
            {spec.type === "line" ? (
              <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid stroke={INK.grid} vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: INK.secondary }} tickLine={false} axisLine={{ stroke: INK.grid }} />
                <YAxis tick={{ fontSize: 11, fill: INK.secondary }} tickLine={false} axisLine={false} tickFormatter={fmt} width={56} />
                <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 12, color: INK.primary }} />
                {multi && <Legend wrapperStyle={{ fontSize: 11, color: INK.secondary }} />}
                {series.map((s, i) => (
                  <Line key={s.name} type="monotone" dataKey={s.name} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 5 }} />
                ))}
              </LineChart>
            ) : (
              <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }} barGap={2} barCategoryGap="28%">
                <CartesianGrid stroke={INK.grid} vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: INK.secondary }} tickLine={false} axisLine={{ stroke: INK.grid }} />
                <YAxis tick={{ fontSize: 11, fill: INK.secondary }} tickLine={false} axisLine={false} tickFormatter={fmt} width={56} />
                <Tooltip cursor={{ fill: "#eef1f5" }} formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 12, color: INK.primary }} />
                {multi && <Legend wrapperStyle={{ fontSize: 11, color: INK.secondary }} />}
                {series.map((s, i) => (
                  <Bar key={s.name} dataKey={s.name} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={48} />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {(spec.y_label || spec.x_label) && !asTable && (
        <p className="flex gap-4 px-1 text-xs text-slate">
          {spec.y_label && <span>Vertical: {spec.y_label}</span>}
          {spec.x_label && <span>Horizontal: {spec.x_label}</span>}
        </p>
      )}
    </figure>
  );
}
