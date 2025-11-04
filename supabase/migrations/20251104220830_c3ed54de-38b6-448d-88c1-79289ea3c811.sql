-- Add tariff fields for Santé/Entrepôts/Commerce category based on building surface
ALTER TABLE public.product_catalog
ADD COLUMN IF NOT EXISTS valeur_sante_entrepot_commerce_ge_400 numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS valeur_sante_entrepot_commerce_lt_400 numeric DEFAULT NULL;

COMMENT ON COLUMN public.product_catalog.valeur_sante_entrepot_commerce_ge_400 IS 'Tarif pour bâtiments >= 400m² (Santé/Entrepôts/Commerce)';
COMMENT ON COLUMN public.product_catalog.valeur_sante_entrepot_commerce_lt_400 IS 'Tarif pour bâtiments < 400m² (Santé/Entrepôts/Commerce)';