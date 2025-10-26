alter table public.product_catalog
  drop column if exists valorisation_tarif_override,
  add column if not exists valorisation_bonification numeric,
  add column if not exists valorisation_coefficient numeric;
