"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartSpec } from "@/lib/tools/make_chart";

// Validated categorical palette (light steps), assigned in fixed order, never cycled.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const INK = { primary: "#18181b", secondary: "#52514e", grid: "#e4e4e7" };

const fmt = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function AnalystChart({ spec }: { spec: ChartSpec }) {
  const [asTable, setAsTable] = useState(false);
  const series = spec.series.slice(0, SERIES.length);
  const rows = spec.categories.map((c, i) => ({ category: c, ...Object.fromEntries(series.map((s) => [s.name, s.values[i]])) }));
  const multi = series.length > 1;

  return (
    <figure className="rounded-md border border-zinc-200 bg-white p-2">
      <figcaption className="mb-1 flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-semibold text-zinc-900">{spec.title}</span>
        <button type="button" onClick={() => setAsTable(!asTable)} className="text-[11px] text-zinc-600 underline underline-offset-2">
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </figcaption>
      {asTable ? (
        <table className="w-full text-xs">
          <thead className="text-zinc-500">
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
              <tr key={r.category} className="border-t border-zinc-100">
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
                <Tooltip cursor={{ fill: "#f4f4f5" }} formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 12, color: INK.primary }} />
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
        <p className="px-1 text-[11px] text-zinc-500">{[spec.y_label && `Y: ${spec.y_label}`, spec.x_label && `X: ${spec.x_label}`].filter(Boolean).join(" · ")}</p>
      )}
    </figure>
  );
}
