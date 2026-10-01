-- A later document from the same supplier can revise a price (for example a
-- reconfirmation reply). The ledger keeps the earlier price as a 'revision' step.
alter table public.normalisation_step drop constraint normalisation_step_kind_check;
alter table public.normalisation_step add constraint normalisation_step_kind_check
  check (kind in ('fx', 'uom', 'pack_size', 'gst', 'discount', 'freight', 'bundle', 'revision'));
