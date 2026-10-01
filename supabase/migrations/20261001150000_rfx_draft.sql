-- The RFx draft built with the co-pilot, separate from the seeded RFx the rest of the
-- app uses. One draft at a time; the conversation is kept with it.
create table public.rfx_draft (
  id uuid primary key default gen_random_uuid(),
  draft jsonb not null,
  conversation jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.rfx_draft enable row level security;

-- Reset demo clears the draft too.
create or replace function public.reset_demo_data()
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
    public.fx_rate,
    public.rfx_draft
  cascade;
$$;
revoke all on function public.reset_demo_data() from public, anon, authenticated;
grant execute on function public.reset_demo_data() to service_role;
