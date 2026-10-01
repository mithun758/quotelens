-- The stubbed "sent" email is shown in full: keep its subject and when it was sent.
alter table public.clarification add column subject text;
alter table public.clarification add column sent_at timestamptz not null default now();
