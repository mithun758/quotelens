import { db } from "@/lib/db/client";
import { runHistory, type RunHistory } from "@/lib/eval/runs";
import { scoreExtraction, type SupplierScore } from "@/lib/eval/score";
import { Badge } from "@/components/ui/badge";
import { ScreenHeader, SectionHeader } from "@/components/ui/ScreenHeader";
import { RunExtractionButton } from "./RunExtractionButton";

export const metadata = { title: "Evaluation · QuoteLens" };
export const dynamic = "force-dynamic";
// Extraction of all five suppliers runs as a server action from this page.
export const maxDuration = 300;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const usd = (n: number | null) => (n === null ? "n/a" : `$${Number(n).toFixed(n < 1 ? 4 : 2)}`);
const ist = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const inr = (n: number | null) => (n === null ? "none" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

function Cell({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <td className={`px-3 py-1.5 text-right ${ok ? "" : "font-semibold text-oxblood"}`}>{children}</td>;
}

const STATUS: Record<string, string> = { extracted: "Read", received: "Not read", processing: "Reading", failed: "Failed" };
const th = "border-b-2 border-rule-strong px-3 py-2 text-meta font-semibold text-slate";

// Accuracy as a figure with a ledger bar; below 100% the bar's gap shows the misses.
function Bar({ value }: { value: number }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <span aria-hidden className="h-1 w-10 rounded-xs bg-rule @4xl:w-20">
        <span className={`block h-full rounded-xs ${value === 1 ? "bg-ledger" : "bg-pencil"}`} style={{ width: `${value * 100}%` }} />
      </span>
      <span className="w-12 text-right">{pct(value)}</span>
    </span>
  );
}

function SupplierDetail({ s }: { s: SupplierScore }) {
  const lineMisses = s.lines.filter((l) => !l.valueOk || !l.confidenceOk);
  const termMisses = s.terms.filter((t) => !t.ok);
  const qMisses = s.questionnaire.filter((q) => !q.ok);
  const misses = lineMisses.length + termMisses.length + qMisses.length;
  return (
    <details className="rounded-xs border border-rule bg-sheet">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-body">
        <span className="font-semibold">
          <span className="text-slate">{s.code}</span> {s.name}
        </span>
        <Badge variant={misses ? "oxblood" : "ledger"}>{misses ? `${misses} mismatch${misses === 1 ? "" : "es"}` : "No mismatches"}</Badge>
      </summary>
      <div className="space-y-4 overflow-x-auto px-4 pb-4">
        <table className="w-full border-collapse text-table">
          <thead>
            <tr>
              <th className={`${th} text-left`}>Line</th>
              <th className={`${th} text-right`}>Expected</th>
              <th className={`${th} text-right`}>Extracted</th>
              <th className={`${th} text-right`}>Expected state</th>
              <th className={`${th} text-right`}>Extracted state</th>
              <th className={`${th} text-left`}>Raw value</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.line_no} className={`border-b border-rule ${l.valueOk && l.confidenceOk ? "" : "bg-oxblood-tint"}`}>
                <td className="px-3 py-1.5 text-slate">{l.line_no}</td>
                <td className="px-3 py-1.5 text-right">{inr(l.expected.value)}</td>
                <Cell ok={l.valueOk}>{inr(l.actual.value)}</Cell>
                <td className="px-3 py-1.5 text-right">{l.expected.confidence}</td>
                <Cell ok={l.confidenceOk}>{l.actual.confidence ?? "none"}</Cell>
                <td className="px-3 py-1.5 text-slate">{l.actual.raw ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid gap-4 @3xl:grid-cols-2">
          {[
            { title: "Terms", rows: s.terms.map((t) => ({ key: t.field, expected: t.expected, actual: t.actual, ok: t.ok })) },
            { title: "Questionnaire", rows: s.questionnaire.map((q) => ({ key: q.key, expected: q.expected, actual: q.actual, ok: q.ok })) },
          ].map((t) => (
            <table key={t.title} className="w-full border-collapse text-table">
              <thead>
                <tr>
                  <th className={`${th} text-left`}>{t.title}</th>
                  <th className={`${th} text-right`}>Expected</th>
                  <th className={`${th} text-right`}>Extracted</th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.key} className={`border-b border-rule ${r.ok ? "" : "bg-oxblood-tint"}`}>
                    <td className="px-3 py-1.5">{r.key.replace(/_/g, " ")}</td>
                    <td className="px-3 py-1.5 text-right">{r.expected ?? "none"}</td>
                    <Cell ok={r.ok}>{r.actual ?? "none"}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
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
    <section aria-labelledby="cost-title" className="space-y-3">
      <SectionHeader id="cost-title" title="Cost" description={`Latest full run, ${ist(latest.started_at)} IST, ${Math.round((latest.duration_ms ?? 0) / 1000)}s. Includes retried attempts. Anthropic list prices.`} />
      <div className="grid gap-4 @4xl:grid-cols-2">
        <div className="rounded-xs border border-rule bg-sheet">
          <table className="w-full border-collapse text-table">
            <thead>
              <tr>
                <th className={`${th} text-left`}>Supplier</th>
                <th className={`${th} text-right`}>Calls</th>
                <th className={`${th} text-right`}>Input tokens</th>
                <th className={`${th} text-right`}>Output tokens</th>
                <th className={`${th} text-right`}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {latestCosts.map((c) => (
                <tr key={c.supplier} className="border-b border-rule">
                  <td className="px-3 py-1.5">{c.supplier}</td>
                  <td className="px-3 py-1.5 text-right">{c.calls}</td>
                  <td className="px-3 py-1.5 text-right">{c.inputTokens.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-1.5 text-right">{c.outputTokens.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-1.5 text-right">{usd(c.costUsd)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-rule-strong font-semibold">
                <td className="px-3 py-1.5">Full run</td>
                <td className="px-3 py-1.5 text-right">{latestCosts.reduce((s, c) => s + c.calls, 0)}</td>
                <td className="px-3 py-1.5 text-right">{latestCosts.reduce((s, c) => s + c.inputTokens, 0).toLocaleString("en-IN")}</td>
                <td className="px-3 py-1.5 text-right">{latestCosts.reduce((s, c) => s + c.outputTokens, 0).toLocaleString("en-IN")}</td>
                <td className="px-3 py-1.5 text-right">{usd(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="rounded-xs border border-rule bg-sheet">
          <table className="w-full border-collapse text-table">
            <thead>
              <tr>
                <th className={`${th} text-left`}>Recent full runs</th>
                <th className={`${th} text-right`}>Time</th>
                <th className={`${th} text-right`}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((r) => (
                <tr key={r.id} className="border-b border-rule">
                  <td className="px-3 py-1.5">
                    {ist(r.started_at)}
                    {r.status === "partial" ? " (partial)" : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right">{Math.round((r.duration_ms ?? 0) / 1000)}s</td>
                  <td className="px-3 py-1.5 text-right">{usd(r.cost_usd === null ? null : Number(r.cost_usd))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function VarianceSection({ history }: { history: RunHistory }) {
  const { runsCompared, valueVariations, confidenceVariations } = history.variance;
  const fmt = (v: { supplier: string; line: number; values: (number | null)[]; confidences: string[] }, field: "values" | "confidences") =>
    `${v.supplier} line ${v.line}: ${(field === "values" ? v.values.map((x) => inr(x)) : v.confidences).join(" / ")}`;
  return (
    <section aria-labelledby="variance-title" className="space-y-2 rounded-xs border-l-2 border-amber bg-amber-tint px-4 py-3 text-body">
      <h2 id="variance-title" className="font-semibold">
        Known limitation: run-to-run variance
      </h2>
      <p>
        The extraction model does not accept a fixed temperature, so two runs over the same documents can differ. Arithmetic is deterministic code, so differences come only from what the model reads or how it judges confidence. Compared across the last {runsCompared} full run
        {runsCompared === 1 ? "" : "s"} (newest first):
      </p>
      {runsCompared < 2 ? (
        <p className="text-slate">Needs at least two full runs.</p>
      ) : (
        <ul className="space-y-1">
          <li>
            Normalised values that changed: <span className="font-semibold">{valueVariations.length}</span>
            {valueVariations.length > 0 && <span className="text-slate"> ({valueVariations.map((v) => fmt(v, "values")).join("; ")})</span>}
          </li>
          <li>
            Confidence states that changed: <span className="font-semibold">{confidenceVariations.length}</span>
            {confidenceVariations.length > 0 && <span className="text-slate"> ({confidenceVariations.map((v) => fmt(v, "confidences")).join("; ")})</span>}
          </li>
        </ul>
      )}
    </section>
  );
}

export default async function EvalPage() {
  const [report, history] = await Promise.all([scoreExtraction(db()), runHistory(db())]);
  const { overall } = report;
  const latest = history.latest;
  const latestCost = history.latestCosts.reduce((s, c) => s + c.costUsd, 0);

  return (
    <div className="space-y-8">
      <ScreenHeader
        title="Evaluation"
        description={`Stored extraction scored against the ground truth for every supplier and line. Values match within ₹1.${report.extractedAt ? "" : " No extraction has run yet."}`}
      />

      <section aria-label="Summary" className="grid grid-cols-2 items-end gap-6 rounded-xs border border-rule bg-sheet p-6 @4xl:grid-cols-[auto_1fr_1fr_1fr_auto]">
        <div>
          <p className="text-meta text-slate">Overall accuracy</p>
          <p className="text-display font-semibold">{pct(overall.accuracy)}</p>
          <p className="text-meta text-slate">
            {overall.correct} of {overall.fields} fields correct
          </p>
        </div>
        <div>
          <p className="text-meta text-slate">Normalised values correct</p>
          <p className="text-heading font-semibold">{pct(overall.valueAccuracy)}</p>
          <p className="text-meta text-slate">Confidence states {pct(overall.confidenceAccuracy)}</p>
        </div>
        <div>
          <p className="text-meta text-slate">Cost of last run</p>
          <p className="text-heading font-semibold">{latest ? usd(latestCost) : "No full run yet"}</p>
        </div>
        <div>
          <p className="text-meta text-slate">Time of last run</p>
          <p className="text-heading font-semibold">{latest ? `${Math.round((latest.duration_ms ?? 0) / 1000)}s` : "None"}</p>
          <p className="text-meta text-slate">{report.extractedAt ? `${ist(report.extractedAt)} IST` : ""}</p>
        </div>
        <RunExtractionButton />
      </section>

      <section aria-labelledby="suppliers-title" className="space-y-3">
        <SectionHeader id="suppliers-title" title="By supplier" />
        <div className="overflow-x-auto rounded-xs border border-rule bg-sheet">
          <table className="w-full min-w-[48rem] border-collapse text-table">
            <thead>
              <tr>
                <th className={`${th} text-left`}>Supplier</th>
                <th className={`${th} text-left`}>Status</th>
                <th className={`${th} text-right`}>Values</th>
                <th className={`${th} text-right`}>Confidence</th>
                <th className={`${th} text-right`}>Raw values</th>
                <th className={`${th} text-right`}>Terms</th>
                <th className={`${th} text-right`}>Questionnaire</th>
              </tr>
            </thead>
            <tbody>
              {report.suppliers.map((s) => (
                <tr key={s.code} className="border-b border-rule hover:bg-tint">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-slate">{s.code}</span> {s.name}
                  </td>
                  <td className="px-3 py-2 text-slate">{(s.status && STATUS[s.status]) ?? s.status ?? "No response"}</td>
                  <td className="px-3 py-2">
                    <Bar value={s.valueAccuracy} />
                  </td>
                  <td className="px-3 py-2">
                    <Bar value={s.confidenceAccuracy} />
                  </td>
                  <td className="px-3 py-2">
                    <Bar value={s.rawAccuracy} />
                  </td>
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
      </section>

      <VarianceSection history={history} />
      <CostSection history={history} />

      <section aria-labelledby="lines-title" className="space-y-3">
        <SectionHeader id="lines-title" title="Line by line" description="Every line against the ground truth. Mismatches are shaded." />
        <div className="space-y-2">
          {report.suppliers.map((s) => (
            <SupplierDetail key={s.code} s={s} />
          ))}
        </div>
      </section>
    </div>
  );
}
