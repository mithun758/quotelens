-- Arjun (Head of IT) signs off substitute models, so he is an audit actor too.
alter table public.audit_event drop constraint audit_event_actor_check;
alter table public.audit_event add constraint audit_event_actor_check check (actor in ('priya', 'arjun', 'system', 'model'));
