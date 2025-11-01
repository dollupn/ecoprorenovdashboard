DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sites'
      AND column_name = 'commission_eur_per_m2_enabled'
  ) THEN
    ALTER TABLE public.sites
      ADD COLUMN commission_eur_per_m2_enabled BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sites'
      AND column_name = 'commission_eur_per_m2'
  ) THEN
    ALTER TABLE public.sites
      ADD COLUMN commission_eur_per_m2 NUMERIC DEFAULT 0;
  END IF;
END;
$$;

UPDATE public.sites
SET
  commission_eur_per_m2_enabled = CASE
    WHEN commission_commerciale_ht IS NULL THEN commission_eur_per_m2_enabled
    WHEN lower(trim(commission_commerciale_ht::text)) IN ('true', 't', '1', 'oui', 'yes', 'on') THEN TRUE
    ELSE FALSE
  END,
  commission_eur_per_m2 = CASE
    WHEN commission_commerciale_ht_montant IS NULL THEN commission_eur_per_m2
    WHEN commission_commerciale_ht_montant = 0
         AND COALESCE(commission_eur_per_m2, 0) <> 0 THEN commission_eur_per_m2
    ELSE commission_commerciale_ht_montant
  END
WHERE commission_commerciale_ht IS NOT NULL
   OR (
     commission_commerciale_ht_montant IS NOT NULL
     AND (
       commission_commerciale_ht_montant <> 0
       OR COALESCE(commission_eur_per_m2, 0) = 0
     )
   );

COMMENT ON COLUMN public.sites.commission_eur_per_m2_enabled IS 'Active une commission commerciale par mètre carré';
COMMENT ON COLUMN public.sites.commission_eur_per_m2 IS 'Montant de la commission commerciale exprimée en euros par m²';
