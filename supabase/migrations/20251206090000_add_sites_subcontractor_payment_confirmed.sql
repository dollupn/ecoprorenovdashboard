ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS subcontractor_payment_confirmed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sites.subcontractor_payment_confirmed IS 'Indique si le paiement du sous-traitant est confirmé.';
