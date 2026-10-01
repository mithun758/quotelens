"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ACCEPT, MAX_UPLOAD_BYTES } from "@/lib/uploads/validate";
import { ErrorNote } from "../ErrorNote";
import { btn, input } from "../ui/styles";

type Phase = { kind: "idle" } | { kind: "working" } | { kind: "done"; text: string; code: string } | { kind: "error"; text: string };

// Add a supplier response from a file: stored, then read by the same extraction pipeline.
export function AddResponse({ suppliers }: { suppliers: { code: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const tooBig = !!file && file.size > MAX_UPLOAD_BYTES;
  const ready = !!file && !tooBig && (supplier === "new" ? name.trim().length >= 2 : !!supplier);

  async function submit() {
    if (!file) return;
    setPhase({ kind: "working" });
    const body = new FormData();
    body.set("supplier", supplier);
    body.set("name", name);
    body.set("file", file);
    try {
      const res = await fetch("/api/responses", { method: "POST", body });
      const r = (await res.json()) as { supplier?: string; coverage?: number; missing?: number; inferred?: number; error?: string };
      router.refresh();
      if (!res.ok || r.error) return setPhase({ kind: "error", text: r.error ?? "The response could not be added. Try again." });
      setPhase({ kind: "done", code: r.supplier!, text: `Read. ${r.coverage} RFx lines mapped, ${r.inferred} Inferred, ${r.missing} Missing. Unmatched items are listed in the extraction table and the review queue.` });
      setFile(null);
    } catch {
      setPhase({ kind: "error", text: "The request failed. Check the connection and try again." });
    }
  }

  // A list item in the supplier inbox: a dashed card, then the form across the full row.
  if (!open) {
    return (
      <li className="min-w-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-1 rounded-xs px-3 text-center border border-dashed border-slate text-body font-semibold text-ink hover:bg-tint"
        >
          <Plus aria-hidden className="size-4 stroke-[1.5] text-slate" />
          Add a response
          <span className="text-meta font-normal text-slate">PDF, Excel, Word, photo or text</span>
        </button>
      </li>
    );
  }
  return (
    <li className="col-span-full space-y-3 rounded-xs border border-rule bg-sheet p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-heading font-semibold">Add a response</h3>
          <p className="text-xs text-slate">One file, up to 10 MB: PDF, Excel (.xlsx), Word (.docx), JPG, PNG or text. Claude reads it like the others; nothing is imputed, and lines it cannot find stay Missing.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate hover:text-ink">
          Close
        </button>
      </div>
      <div className="grid grid-cols-1 items-end gap-3 @3xl:grid-cols-[14rem_14rem_1fr]">
        <label className="text-xs text-slate">
          Supplier
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`${input} mt-1 w-full`} disabled={phase.kind === "working"}>
            <option value="">Choose a supplier</option>
            {suppliers.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code}. {s.name}
              </option>
            ))}
            <option value="new">New supplier</option>
          </select>
        </label>
        {supplier === "new" ? (
          <label className="text-xs text-slate">
            New supplier name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={`${input} mt-1 w-full`} disabled={phase.kind === "working"} />
          </label>
        ) : (
          <span />
        )}
        <label className="text-xs text-slate">
          File
          <input
            type="file"
            accept={ACCEPT}
            disabled={phase.kind === "working"}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPhase({ kind: "idle" });
            }}
            className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-xs file:border file:border-slate file:bg-sheet file:px-2 file:py-1 file:text-sm file:font-semibold file:text-ink hover:file:bg-tint"
          />
        </label>
      </div>
      {tooBig && <p className="text-xs text-oxblood">This file is {(file!.size / 1024 / 1024).toFixed(1)} MB; the limit is 10 MB.</p>}
      <div className="flex items-center gap-3">
        <button type="button" disabled={!ready || phase.kind === "working"} onClick={submit} className={btn.primary}>
          {phase.kind === "working" ? "Reading the file..." : "Add and extract"}
        </button>
        {phase.kind === "working" && (
          <span role="status" className="text-xs text-slate">
            Uploading and reading. Most files take 20 to 60 seconds.
          </span>
        )}
      </div>
      <div aria-live="polite">
        {phase.kind === "done" && (
          <p className="border-l-[3px] border-ledger bg-ledger-tint px-3 py-2 text-sm text-ledger">
            {phase.text}{" "}
            <a href={`/quotes?supplier=${phase.code}#exceptions`} className="font-semibold underline">
              Review it
            </a>
          </p>
        )}
      </div>
      {phase.kind === "error" && <ErrorNote message={phase.text} onRetry={ready ? submit : undefined} />}
    </li>
  );
}
