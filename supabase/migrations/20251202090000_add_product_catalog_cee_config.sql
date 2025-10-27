alter table public.product_catalog
  add column if not exists cee_config jsonb;

comment on column public.product_catalog.cee_config is
  'Optional JSON configuration for CEE settings. Expected structure: {"defaults":{"bonification":number|null,"coefficient":number|null,"multiplier":{"key":string|null,"coefficient":number|null}},"overrides":{"<building_type>":{"bonification":number|null,"coefficient":number|null,"multiplier":{"key":string|null,"coefficient":number|null}}}}';
