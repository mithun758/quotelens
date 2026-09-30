# CLAUDE.md: QuoteLens

## What this is
QuoteLens is a prototype for the Aerchain PM take-home "Kill the Quote Spreadsheet".
One flow: draft an RFx, receive five messy supplier quotes, extract and normalise them,
check whether each quote is still decision-worthy (Quote Freshness), interrogate the
comparison in plain language, and reach a defensible award.

**`docs/SOURCE_OF_TRUTH.md` is the authority.** Read it before every phase. If anything
here conflicts with it, the source of truth wins. If you need to deviate, stop and ask,
then add a row to its Decision log.

Customer: Meridian Diagnostics (fictional). Buyer: Priya. Head of IT: Arjun.
Approver: Meera, Head of Commercial Finance.

## Non-negotiable rules
1. **The model reads and reasons; code computes.** Every total, conversion, ranking,
   scenario and freshness status is calculated in TypeScript. No model-generated number
   reaches the screen without coming from a tool result.
2. **No value without a source.** Every ExtractedValue stores source document, locator
   and verbatim snippet. Reject extraction output that lacks a snippet.
3. **Three confidence states only:** Extracted, Inferred, Missing. Inferred carries a
   one-line reason. Missing is never imputed and never treated as zero.
4. **Every transformation is logged** as a NormalisationStep (fx, uom, pack_size, gst,
   discount, freight) with input, output, rate, rate source and date.
5. **Nothing hardcoded.** No canned answers for demo questions. Re-running extraction
   must reproduce the comparison. Seed data is inputs only, never outputs.
6. **The buyer decides.** The system never awards on its own. The award memo is blocked
   by open blockers unless overridden with a typed reason, logged as an AuditEvent.
7. **Plumbing is stubbed, AI loops are real.** Email sending is faked. Extraction,
   clarification parsing, co-pilot and analyst are live Claude calls.

## Stack
- Next.js (App Router) + TypeScript, Tailwind CSS
- Supabase: Postgres + Storage (server-side service role key only)
- Anthropic TypeScript SDK (`@anthropic-ai/sdk`); model from `ANTHROPIC_MODEL`
  (default `claude-sonnet-5-5`). PDFs sent as document blocks, the photo as an image block.
- zod for every model output schema; retry once on schema failure, then surface an error
- SheetJS (`xlsx`) for Excel, `mammoth` for Word, plain text for email bodies
- Recharts for charts; server-side PDF export for the award memo
- Vitest for unit tests
- Hosted on Vercel; every push to `main` deploys

## Folder structure
```
/app                  routes: /rfx, /quotes, /comparison, /award, /eval, /api/*
/components           UI components
/lib/ai               prompts, extraction, clarification, co-pilot, analyst loop
/lib/tools            analyst tools (typed, deterministic, one file per tool)
/lib/normalise        fx, uom, pack size, gst, discount, freight, ledger
/lib/freshness        the six freshness rules + supplier status
/lib/scenarios        Best Quote, Best Supplier, Incumbent, Best Without Incumbent, Custom
/lib/db               Supabase client, typed queries
/supabase/migrations  schema SQL
/seed                 seed script, supplier source files, ground truth labels, benchmarks
/docs                 SOURCE_OF_TRUTH.md
/tests                vitest
```

## Conventions
- UK English in all UI copy. Use "supplier", "RFx", "Quote Comparison", "L1", "scenario".
- No em dashes in UI copy.
- INR formatted with Indian grouping (`en-IN`: ₹1,05,000). Show lakh or crore for totals.
- Normalisation basis everywhere: INR, per piece, ex-GST, delivered to hub.
- As-of date comes from config (seeded 30 Sep 2026), never `new Date()` in business logic.
- Benchmarks and FX are seeded and labelled "illustrative" in the UI.
- Every server action that changes data writes an AuditEvent.
- Keep components small; business logic lives in /lib, never in components.

## Environment variables
```
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5-5
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEMO_PASSCODE=
AS_OF_DATE=2026-09-30
```
Never expose ANTHROPIC_API_KEY or SUPABASE_SERVICE_ROLE_KEY to the client.

## Commands (macOS, zsh)
```
npm run dev          # local dev
npm run seed         # reset DB and load seed data
npm run test         # vitest
npm run build        # production build check before every push
```

## How to work
- Build one phase at a time from the Build plan in the source of truth.
- Before coding a phase: restate its done criteria and list the files you will touch.
- After coding: run tests and `npm run build`, check each done criterion, report
  pass or fail per criterion, then commit with message `phase N: <summary>`.
- If a done criterion fails, fix it before moving on.
- When unsure about product behaviour, ask. Do not invent requirements.
- Prefer boring, readable code over clever code. This is a demo that must not break live.
