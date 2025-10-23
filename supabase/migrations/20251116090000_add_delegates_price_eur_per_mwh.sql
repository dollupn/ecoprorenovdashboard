alter table public.delegates
  add column if not exists price_eur_per_mwh numeric;
