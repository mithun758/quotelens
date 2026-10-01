-- Discounts as data, so scenarios can apply a conditional discount when its condition
-- is met: [{ "percent": 4, "threshold_inr": 2500000, "condition": "...", "applies_to_lines": [] }].
alter table public.quote_terms add column discounts jsonb not null default '[]'::jsonb;
