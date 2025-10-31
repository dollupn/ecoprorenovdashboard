-- Ensure additional_costs uses jsonb with a consistent structure
ALTER TABLE public.sites
  ALTER COLUMN additional_costs TYPE jsonb USING COALESCE(additional_costs, '[]'::jsonb),
  ALTER COLUMN additional_costs SET DEFAULT '[]'::jsonb;

-- Normalize existing payloads to the new structure { label, amount_ht, montant_tva, amount_ttc, attachment }
UPDATE public.sites
SET additional_costs = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'label', COALESCE(cost->>'label', ''),
        'amount_ht', COALESCE(
          CASE
            WHEN (cost->>'amount_ht') ~ '^[-]?[0-9]+(\.[0-9]+)?$' THEN (cost->>'amount_ht')::numeric
            ELSE NULL
          END,
          CASE
            WHEN (cost->>'amount_ttc') ~ '^[-]?[0-9]+(\.[0-9]+)?$' THEN (cost->>'amount_ttc')::numeric
            ELSE NULL
          END,
          CASE
            WHEN (cost->>'amount') ~ '^[-]?[0-9]+(\.[0-9]+)?$' THEN (cost->>'amount')::numeric
            ELSE NULL
          END,
          0
        ),
        'montant_tva', COALESCE(
          CASE
            WHEN (cost->>'montant_tva') ~ '^[-]?[0-9]+(\.[0-9]+)?$' THEN (cost->>'montant_tva')::numeric
            ELSE NULL
          END,
          CASE
            WHEN (cost->>'taxes') ~ '^[-]?[0-9]+(\.[0-9]+)?$' THEN (cost->>'taxes')::numeric
            ELSE NULL
          END,
          0
        ),
        'amount_ttc', COALESCE(
          CASE
            WHEN (cost->>'amount_ttc') ~ '^[-]?[0-9]+(\.[0-9]+)?$' THEN (cost->>'amount_ttc')::numeric
            ELSE NULL
          END,
          CASE
            WHEN (cost->>'amount') ~ '^[-]?[0-9]+(\.[0-9]+)?$' THEN (cost->>'amount')::numeric
            ELSE NULL
          END,
          COALESCE(
            CASE
              WHEN (cost->>'amount_ht') ~ '^[-]?[0-9]+(\.[0-9]+)?$' THEN (cost->>'amount_ht')::numeric
              ELSE NULL
            END,
            0
          ) + COALESCE(
            CASE
              WHEN (cost->>'montant_tva') ~ '^[-]?[0-9]+(\.[0-9]+)?$' THEN (cost->>'montant_tva')::numeric
              ELSE NULL
            END,
            CASE
              WHEN (cost->>'taxes') ~ '^[-]?[0-9]+(\.[0-9]+)?$' THEN (cost->>'taxes')::numeric
              ELSE NULL
            END,
            0
          )
        ),
        'attachment', NULLIF(cost->>'attachment', '')
      )
    )
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(additional_costs) = 'array' THEN additional_costs
        ELSE '[]'::jsonb
      END
    ) AS cost
  ),
  '[]'::jsonb
);

COMMENT ON COLUMN public.sites.additional_costs IS 'Liste des frais de chantier (label, amount_ht, montant_tva, amount_ttc, attachment)';
