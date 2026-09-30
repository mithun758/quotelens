-- QuoteLens initial schema: the thirteen entities in the source of truth Data model,
-- plus the seeded illustrative series BenchmarkSeries and FxRate.
--
-- Columns beyond the Data model table fill gaps logged in the Decision log:
--   rfx.sent_at, rfx.questionnaire, line_item.category, line_item.memory_exposed,
--   supplier.code, response.rfx_id, extracted_value.match_reason,
--   extracted_value.substitute_check, extracted_value.substitute_status.
--
-- Enumerations are text with check constraints so they are easy to extend.
-- Money is numeric(14,2) INR; rates and index values use wider precision.
-- RLS is enabled with no policies: only the server-side service role can read or
-- write. The browser never talks to Supabase directly.

-- ---------------------------------------------------------------------------
-- RFx and its lines
-- ---------------------------------------------------------------------------

create table public.rfx (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  need_by_date date not null,
  approval_days integer not null default 10 check (approval_days >= 0),
  sent_at date,
  -- validity required, GST basis, delivery hubs, warranty, payment
  terms jsonb not null default '{}'::jsonb,
  -- [{ key, text, evidence_required }]; answers reference key
  questionnaire jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'evaluating', 'awarded')),
  created_at timestamptz not null default now()
);

create table public.line_item (
  id uuid primary key default gen_random_uuid(),
  rfx_id uuid not null references public.rfx (id) on delete cascade,
  line_no integer not null check (line_no > 0),
  description text not null,
  category text not null,
  spec jsonb not null default '{}'::jsonb,
  quantity numeric(12, 3) not null check (quantity > 0),
  uom text not null,
  acceptable_equivalents text,
  last_cycle_price_inr numeric(14, 2) check (last_cycle_price_inr >= 0),
  memory_exposed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (rfx_id, line_no)
);

-- ---------------------------------------------------------------------------
-- Suppliers and their responses
-- ---------------------------------------------------------------------------

create table public.supplier (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  gstin text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  state text,
  default_currency text not null default 'INR' check (default_currency ~ '^[A-Z]{3}$'),
  is_incumbent boolean not null default false,
  created_at timestamptz not null default now()
);

-- At most one incumbent.
create unique index supplier_one_incumbent on public.supplier (is_incumbent) where is_incumbent;

create table public.response (
  id uuid primary key default gen_random_uuid(),
  rfx_id uuid not null references public.rfx (id) on delete cascade,
  supplier_id uuid not null references public.supplier (id) on delete cascade,
  received_at timestamptz not null,
  channel text not null default 'email',
  body_text text,
  status text not null default 'received'
    check (status in ('received', 'processing', 'extracted', 'failed')),
  coverage_count integer check (coverage_count >= 0),
  created_at timestamptz not null default now()
);

create index response_rfx_idx on public.response (rfx_id);
create index response_supplier_idx on public.response (supplier_id);

create table public.document (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.response (id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  storage_path text not null,
  page_count integer check (page_count >= 0),
  created_at timestamptz not null default now()
);

create index document_response_idx on public.document (response_id);

-- ---------------------------------------------------------------------------
-- Extraction and normalisation
-- ---------------------------------------------------------------------------

create table public.extracted_value (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.response (id) on delete cascade,
  -- null for quote-level fields and for quoted items that match no RFx line
  line_item_id uuid references public.line_item (id) on delete cascade,
  field text not null,
  raw_value text,
  raw_unit text,
  raw_currency text,
  normalised_value_inr numeric(14, 2),
  confidence_state text not null check (confidence_state in ('extracted', 'inferred', 'missing')),
  reason text,
  -- null when the source is the email body held on response.body_text
  source_document_id uuid references public.document (id) on delete cascade,
  -- { page, cell, bbox, span } as applicable
  source_locator jsonb,
  source_snippet text,
  -- why the model mapped this quoted item to this RFx line
  match_reason text,
  -- per-attribute check of a substitute model: [{ attribute, required, offered, result }]
  substitute_check jsonb,
  substitute_status text check (substitute_status in ('pending', 'approved', 'rejected')),
  status text not null default 'needs_review'
    check (status in ('auto_accepted', 'needs_review', 'confirmed', 'corrected')),
  created_at timestamptz not null default now(),
  -- No value without a source.
  constraint extracted_value_has_source check (
    confidence_state = 'missing'
    or (source_snippet is not null and length(btrim(source_snippet)) > 0 and source_locator is not null)
  ),
  -- Inferred always carries its one-line reason.
  constraint extracted_value_inferred_reason check (
    confidence_state <> 'inferred' or (reason is not null and length(btrim(reason)) > 0)
  ),
  -- Missing is never imputed.
  constraint extracted_value_missing_not_imputed check (
    confidence_state <> 'missing' or normalised_value_inr is null
  )
);

create index extracted_value_response_idx on public.extracted_value (response_id);
create index extracted_value_line_idx on public.extracted_value (line_item_id);

create table public.normalisation_step (
  id uuid primary key default gen_random_uuid(),
  extracted_value_id uuid not null references public.extracted_value (id) on delete cascade,
  step_order integer not null check (step_order > 0),
  kind text not null check (kind in ('fx', 'uom', 'pack_size', 'gst', 'discount', 'freight')),
  input numeric(18, 6) not null,
  output numeric(18, 6) not null,
  rate numeric(18, 6),
  rate_source text,
  rate_date date,
  created_at timestamptz not null default now(),
  unique (extracted_value_id, step_order)
);

create table public.quote_terms (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null unique references public.response (id) on delete cascade,
  quote_date date,
  valid_until date,
  gst_treatment text,
  freight_terms text,
  warranty text,
  payment_terms text,
  delivery_days integer check (delivery_days >= 0),
  references_prior_pricing boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Flags, clarifications and the questionnaire
-- ---------------------------------------------------------------------------

create table public.flag (
  id uuid primary key default gen_random_uuid(),
  extracted_value_id uuid references public.extracted_value (id) on delete cascade,
  response_id uuid references public.response (id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'overridden')),
  created_at timestamptz not null default now(),
  constraint flag_one_target check (num_nonnulls(extracted_value_id, response_id) = 1)
);

create index flag_extracted_value_idx on public.flag (extracted_value_id);
create index flag_response_idx on public.flag (response_id);

create table public.clarification (
  id uuid primary key default gen_random_uuid(),
  flag_id uuid not null references public.flag (id) on delete cascade,
  supplier_id uuid not null references public.supplier (id) on delete cascade,
  question text not null,
  reply_text text,
  status text not null default 'awaiting' check (status in ('awaiting', 'answered')),
  created_at timestamptz not null default now()
);

create table public.questionnaire_answer (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier (id) on delete cascade,
  question_key text not null,
  answer text,
  pass_fail text check (pass_fail in ('pass', 'fail')),
  evidence_document_id uuid references public.document (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (supplier_id, question_key)
);

-- ---------------------------------------------------------------------------
-- Award and audit
-- ---------------------------------------------------------------------------

create table public.award (
  id uuid primary key default gen_random_uuid(),
  rfx_id uuid not null references public.rfx (id) on delete cascade,
  scenario text not null check (
    scenario in ('best_quote', 'best_supplier', 'incumbent', 'best_quote_without_incumbent', 'custom')
  ),
  allocations jsonb not null default '[]'::jsonb,
  total_inr numeric(14, 2),
  savings_vs_l1 numeric(14, 2),
  savings_vs_last_cycle numeric(14, 2),
  memo_markdown text,
  status text not null default 'draft' check (status in ('draft', 'blocked', 'ready', 'exported')),
  created_at timestamptz not null default now()
);

create table public.audit_event (
  id uuid primary key default gen_random_uuid(),
  actor text not null check (actor in ('priya', 'system', 'model')),
  action text not null,
  target text,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index audit_event_created_idx on public.audit_event (created_at desc);

-- ---------------------------------------------------------------------------
-- Illustrative benchmark series (seeded inputs, labelled illustrative in the UI)
-- ---------------------------------------------------------------------------

create table public.benchmark_series (
  id uuid primary key default gen_random_uuid(),
  series_key text not null,
  label text not null,
  observed_on date not null,
  value numeric(12, 4) not null,
  unit text not null,
  source text not null,
  is_illustrative boolean not null default true,
  created_at timestamptz not null default now(),
  unique (series_key, observed_on)
);

create table public.fx_rate (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  quote_currency text not null check (quote_currency ~ '^[A-Z]{3}$'),
  rate_date date not null,
  rate numeric(12, 4) not null check (rate > 0),
  source text not null,
  is_illustrative boolean not null default true,
  created_at timestamptz not null default now(),
  unique (base_currency, quote_currency, rate_date)
);

-- ---------------------------------------------------------------------------
-- Access: server-side service role only
-- ---------------------------------------------------------------------------

alter table public.rfx enable row level security;
alter table public.line_item enable row level security;
alter table public.supplier enable row level security;
alter table public.response enable row level security;
alter table public.document enable row level security;
alter table public.extracted_value enable row level security;
alter table public.normalisation_step enable row level security;
alter table public.quote_terms enable row level security;
alter table public.flag enable row level security;
alter table public.clarification enable row level security;
alter table public.questionnaire_answer enable row level security;
alter table public.award enable row level security;
alter table public.audit_event enable row level security;
alter table public.benchmark_series enable row level security;
alter table public.fx_rate enable row level security;

-- Wipes every table in one statement. Used by the seed and "Reset demo".
create function public.reset_demo_data()
returns void
language sql
security definer
set search_path = public
as $$
  truncate table
    public.audit_event,
    public.award,
    public.questionnaire_answer,
    public.clarification,
    public.flag,
    public.quote_terms,
    public.normalisation_step,
    public.extracted_value,
    public.document,
    public.response,
    public.supplier,
    public.line_item,
    public.rfx,
    public.benchmark_series,
    public.fx_rate
  cascade;
$$;

revoke all on function public.reset_demo_data() from public, anon, authenticated;
grant execute on function public.reset_demo_data() to service_role;
