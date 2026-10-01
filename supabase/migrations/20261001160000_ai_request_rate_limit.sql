-- Per-session rate limiting for AI calls (operational; not cleared by Reset demo).
create table public.ai_request (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index ai_request_session_kind_idx on public.ai_request (session_id, kind, created_at desc);
create index ai_request_created_idx on public.ai_request (created_at desc);
alter table public.ai_request enable row level security;
