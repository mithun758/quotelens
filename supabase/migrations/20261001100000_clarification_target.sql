-- A clarification names what it asks about by stable keys, because extracted value ids
-- change on every re-extraction: a line and field, or a response-level flag type.
alter table public.clarification add column line_item_id uuid references public.line_item (id) on delete cascade;
alter table public.clarification add column field text;
alter table public.clarification add column target_flag_type text;
alter table public.clarification add column answered_at timestamptz;
