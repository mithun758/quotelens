-- A bundle split (bundle price minus the supplier's standalone price of the other
-- bundled lines) is its own ledger step, so the ledger shows it rather than hiding it.
alter table public.normalisation_step drop constraint normalisation_step_kind_check;
alter table public.normalisation_step add constraint normalisation_step_kind_check
  check (kind in ('fx', 'uom', 'pack_size', 'gst', 'discount', 'freight', 'bundle'));
