-- Operational history, kept across "Reset demo" (reset_demo_data does not touch these).
-- No foreign keys to demo tables, so a reset never cascades into the history.

-- One row per extraction run: all suppliers or a chosen subset.
create table public.extraction_run (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  cost_usd numeric(12, 6),
  -- { "A": { "1": { "value": 71400, "confidence": "inferred" }, ... }, ... }
  snapshot jsonb,
  errors jsonb,
  created_at timestamptz not null default now()
);

-- One row per model API call, including retried attempts.
create table public.model_call (
  id uuid primary key default gen_random_uuid(),
  run_id uuid,
  purpose text not null,
  supplier_code text,
  document_name text,
  model text not null,
  attempt integer not null default 1,
  input_tokens integer not null,
  output_tokens integer not null,
  cache_read_input_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null,
  duration_ms integer not null,
  created_at timestamptz not null default now()
);

create index model_call_run_idx on public.model_call (run_id);
create index extraction_run_started_idx on public.extraction_run (started_at desc);

alter table public.extraction_run enable row level security;
alter table public.model_call enable row level security;
