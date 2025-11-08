-- Add per-typology CEE tariff columns with non-negative constraints
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS cee_autres_lt_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_autres_gte_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_bureaux_lt_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_bureaux_gte_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_commerce_lt_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_commerce_gte_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_enseignement_lt_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_enseignement_gte_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_entrepots_lt_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_entrepots_gte_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_hotellerie_lt_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_hotellerie_gte_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_restauration_lt_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_restauration_gte_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_sante_lt_400 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cee_sante_gte_400 numeric DEFAULT NULL;

DO $$
DECLARE
  column_name text;
  constraint_name text;
BEGIN
  FOREACH column_name IN ARRAY ARRAY[
    'cee_autres_lt_400',
    'cee_autres_gte_400',
    'cee_bureaux_lt_400',
    'cee_bureaux_gte_400',
    'cee_commerce_lt_400',
    'cee_commerce_gte_400',
    'cee_enseignement_lt_400',
    'cee_enseignement_gte_400',
    'cee_entrepots_lt_400',
    'cee_entrepots_gte_400',
    'cee_hotellerie_lt_400',
    'cee_hotellerie_gte_400',
    'cee_restauration_lt_400',
    'cee_restauration_gte_400',
    'cee_sante_lt_400',
    'cee_sante_gte_400'
  ] LOOP
    constraint_name := format('product_catalog_%s_non_negative', column_name);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.product_catalog ADD CONSTRAINT %I CHECK (%I >= 0)',
        constraint_name,
        column_name
      );
    END IF;
  END LOOP;
END
$$;

COMMENT ON COLUMN public.product_catalog.cee_autres_lt_400 IS 'Tarif CEE pour typologie Autres (< 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_autres_gte_400 IS 'Tarif CEE pour typologie Autres (≥ 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_bureaux_lt_400 IS 'Tarif CEE pour typologie Bureaux (< 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_bureaux_gte_400 IS 'Tarif CEE pour typologie Bureaux (≥ 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_commerce_lt_400 IS 'Tarif CEE pour typologie Commerce (< 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_commerce_gte_400 IS 'Tarif CEE pour typologie Commerce (≥ 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_enseignement_lt_400 IS 'Tarif CEE pour typologie Enseignement (< 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_enseignement_gte_400 IS 'Tarif CEE pour typologie Enseignement (≥ 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_entrepots_lt_400 IS 'Tarif CEE pour typologie Entrepôts (< 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_entrepots_gte_400 IS 'Tarif CEE pour typologie Entrepôts (≥ 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_hotellerie_lt_400 IS 'Tarif CEE pour typologie Hôtellerie (< 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_hotellerie_gte_400 IS 'Tarif CEE pour typologie Hôtellerie (≥ 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_restauration_lt_400 IS 'Tarif CEE pour typologie Restauration (< 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_restauration_gte_400 IS 'Tarif CEE pour typologie Restauration (≥ 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_sante_lt_400 IS 'Tarif CEE pour typologie Santé (< 400m²).';
COMMENT ON COLUMN public.product_catalog.cee_sante_gte_400 IS 'Tarif CEE pour typologie Santé (≥ 400m²).';
