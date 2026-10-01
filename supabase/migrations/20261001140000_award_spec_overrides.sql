-- The chosen award: its scenario and toggles, Priya's overrides (each with a typed
-- reason, keyed by stable blocker keys) and the memo with its post-check warnings.
alter table public.award add column spec jsonb not null default '{}'::jsonb;
alter table public.award add column overrides jsonb not null default '[]'::jsonb;
alter table public.award add column memo_warnings jsonb not null default '[]'::jsonb;
alter table public.award add column memo_generated_at timestamptz;
alter table public.award add column updated_at timestamptz not null default now();
