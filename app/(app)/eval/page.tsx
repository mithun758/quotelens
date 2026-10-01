import { db } from "@/lib/db/client";
import { runHistory, type RunHistory } from "@/lib/eval/runs";
import { scoreExtraction, type SupplierScore } from "@/lib/eval/score";
import { RunExtractionButton } from "./RunExtractionButton";

export const metadata = { title: "Extraction eval · QuoteLens" };
export const dynamic = "force-dynamic";
// Extraction of all five suppliers runs as a server action from this page.
export const maxDuration = 300;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const usd = (n: number | null) => (n === null ? "n/a" : `$${Number(n).toFixed(n < 1 ? 4 : 2)}`);
const ist = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const inr = (n: number | null) => (n === null ? "none" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

function Cell({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <td className={`px-2 py-1 text-right ${ok ? "text-zinc-800" : "bg-red-50 font-medium text-red-700"}`}>{children}</td>;
}

function SupplierDetail({ s }: { s: SupplierScore }) {
  const lineMisses = s.lines.filter((l) => !l.valueOk || !l.confidenceOk);
  const termMisses = s.terms.filter((t) => !t.ok);
  const qMisses = s.questionnaire.filter((q) => !q.ok);
  return (
    <details className="rounded-md border border-zinc-200 bg-white">
      <summary className="cursor-pointer px-3 py-2 text-sm">
        <span className="font-medium">
          {s.code}. {s.name}
        </span>
        <span className="ml-2 text-zinc-500">
          {lineMisses.length + termMisses.length + qMisses.length === 0 ? "no mismatches" : `${lineMisses.length + termMisses.length + qMisses.length} mismatches`}
        </span>
      </summary>
      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="px-2 py-1 text-left">Line</th>
              <th className="px-2 py-1 text-right">Expected INR</th>
              <th className="px-2 py-1 text-right">Extracted INR</th>
              <th className="px-2 py-1 text-right">Expected state</th>
              <th className="px-2 py-1 text-right">Extracted state</th>
              <th className="px-2 py-1 text-left">Raw value</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.line_no} className="border-t border-zinc-100">
                <td className="px-2 py-1">{l.line_no}</td>
                <td className="px-2 py-1 text-right">{inr(l.expected.value)}</td>
                <Cell ok={l.valueOk}>{inr(l.actual.value)}</Cell>
                <td className="px-2 py-1 text-right">{l.expected.confidence}</td>
                <Cell ok={l.confidenceOk}>{l.actual.confidence ?? "none"}</Cell>
                <td className="px-2 py-1 text-zinc-600">{l.actual.raw ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <table className="text-xs">
            <tbody>
              {s.terms.map((t) => (
                <tr key={t.field} className="border-t border-zinc-100">
                  <td className="px-2 py-1">{t.field}</td>
                  <td className="px-2 py-1 text-right">{t.expected ?? "none"}</td>
                  <Cell ok={t.ok}>{t.actual ?? "none"}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="text-xs">
            <tbody>
              {s.questionnaire.map((q) => (
                <tr key={q.key} className="border-t border-zinc-100">
                  <td className="px-2 py-1">{q.key}</td>
                  <td className="px-2 py-1 text-right">{q.expected}</td>
                  <Cell ok={q.ok}>{q.actual ?? "none"}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function CostSection({ history }: { history: RunHistory }) {
  const { latest, latestCosts, recentRuns } = history;
  if (!latest) return null;
  const total = latestCosts.reduce((s, c) => s + c.costUsd, 0);
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <h3 className="text-sm font-semibold">Cost</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Latest full run, {ist(latest.started_at)} IST, {Math.round((latest.duration_ms ?? 0) / 1000)}s. Includes retried attempts. Anthropic list prices.
      </p>
      <div className="mt-2 grid gap-4 lg:grid-cols-2">
        <table className="text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-1 text-left">Supplier</th>
              <th className="py-1 text-right">Calls</th>
              <th className="py-1 text-right">Input tokens</th>
              <th className="py-1 text-right">Output tokens</th>
              <th className="py-1 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {latestCosts.map((c) => (
              <tr key={c.supplier} className="border-t border-zinc-100">
                <td className="py-1">{c.supplier}</td>
                <td className="py-1 text-right">{c.calls}</td>
                <td className="py-1 text-right">{c.inputTokens.toLocaleString("en-IN")}</td>
                <td className="py-1 text-right">{c.outputTokens.toLocaleString("en-IN")}</td>
                <td className="py-1 text-right">{usd(c.costUsd)}</td>
              </tr>
            ))}
            <tr className="border-t border-zinc-300 font-semibold">
              <td className="py-1">Full run</td>
              <td className="py-1 text-right">{latestCosts.reduce((s, c) => s + c.calls, 0)}</td>
              <td className="py-1 text-right">{latestCosts.reduce((s, c) => s + c.inputTokens, 0).toLocaleString("en-IN")}</td>
              <td className="py-1 text-right">{latestCosts.reduce((s, c) => s + c.outputTokens, 0).toLocaleString("en-IN")}</td>
              <td className="py-1 text-right">{usd(total)}</td>
            </tr>
          </tbody>
        </table>
        <table className="text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-1 text-left">Recent full runs</th>
              <th className="py-1 text-right">Time</th>
              <th className="py-1 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {recentRuns.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100">
                <td className="py-1">{ist(r.started_at)}{r.status === "partial" ? " (partial)" : ""}</td>
                <td className="py-1 text-right">{Math.round((r.duration_ms ?? 0) / 1000)}s</td>
                <td className="py-1 text-right">{usd(r.cost_usd === null ? null : Number(r.cost_usd))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VarianceSection({ history }: { history: RunHistory }) {
  const { runsCompared, valueVariations, confidenceVariations } = history.variance;
  const fmt = (v: { supplier: string; line: number; values: (number | null)[]; confidences: string[] }, field: "values" | "confidences") =>
    `${v.supplier} line ${v.line}: ${(field === "values" ? v.values.map((x) => inr(x)) : v.confidences).join(" / ")}`;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
      <h3 className="font-semibold">Known limitation: run-to-run variance</h3>
      <p className="mt-1 text-zinc-700">
        The extraction model does not accept a fixed temperature, so two runs over the same documents can differ. Arithmetic is
        deterministic code, so differences come only from what the model reads or how it judges confidence. Compared across the last{" "}
        {runsCompared} full run{runsCompared === 1 ? "" : "s"} (newest first):
      </p>
      {runsCompared < 2 ? (
        <p className="mt-2 text-zinc-600">Needs at least two full runs.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-zinc-800">
          <li>
            Normalised values that changed: <b>{valueVariations.length}</b>
            {valueVariations.length > 0 && <span className="text-zinc-600"> ({valueVariations.map((v) => fmt(v, "values")).join("; ")})</span>}
          </li>
          <li>
            Confidence states that changed: <b>{confidenceVariations.length}</b>
            {confidenceVariations.length > 0 && <span className="text-zinc-600"> ({confidenceVariations.map((v) => fmt(v, "confidences")).join("; ")})</span>}
          </li>
        </ul>
      )}
    </div>
  );
}

export default async function EvalPage() {
  const [report, history] = await Promise.all([scoreExtraction(db()), runHistory(db())]);
  const { overall } = report;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Extraction eval</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Stored extraction scored against the ground truth for every supplier and line. Values match within ₹1.
            {report.extractedAt ? ` Last extraction: ${new Date(report.extractedAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} IST.` : " No extraction has run yet."}
          </p>
        </div>
        <RunExtractionButton />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <p className="text-xs text-zinc-500">All fields</p>
          <p className="text-2xl font-semibold">{pct(overall.accuracy)}</p>
          <p className="text-xs text-zinc-500">
            {overall.correct} of {overall.fields} correct
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <p className="text-xs text-zinc-500">Normalised values</p>
          <p className="text-2xl font-semibold">{pct(overall.valueAccuracy)}</p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <p className="text-xs text-zinc-500">Confidence states</p>
          <p className="text-2xl font-semibold">{pct(overall.confidenceAccuracy)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Values</th>
              <th className="px-3 py-2 text-right">Confidence</th>
              <th className="px-3 py-2 text-right">Raw values</th>
              <th className="px-3 py-2 text-right">Terms</th>
              <th className="px-3 py-2 text-right">Questionnaire</th>
            </tr>
          </thead>
          <tbody>
            {report.suppliers.map((s) => (
              <tr key={s.code} className="border-t border-zinc-100">
                <td className="px-3 py-2">
                  {s.code}. {s.name}
                </td>
                <td className="px-3 py-2 text-zinc-600">{s.status}</td>
                <td className="px-3 py-2 text-right">{pct(s.valueAccuracy)}</td>
                <td className="px-3 py-2 text-right">{pct(s.confidenceAccuracy)}</td>
                <td className="px-3 py-2 text-right">{pct(s.rawAccuracy)}</td>
                <td className="px-3 py-2 text-right">
                  {s.terms.filter((t) => t.ok).length}/{s.terms.length}
                </td>
                <td className="px-3 py-2 text-right">
                  {s.questionnaire.filter((q) => q.ok).length}/{s.questionnaire.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <VarianceSection history={history} />
      <CostSection history={history} />

      <div className="space-y-2">
        {report.suppliers.map((s) => (
          <SupplierDetail key={s.code} s={s} />
        ))}
      </div>
    </section>
  );
}
