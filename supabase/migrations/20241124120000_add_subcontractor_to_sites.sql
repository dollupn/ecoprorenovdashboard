-- Add subcontractor reference to sites
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS subcontractor_id uuid REFERENCES public.subcontractors(id);

CREATE INDEX IF NOT EXISTS sites_subcontractor_id_idx ON public.sites(subcontractor_id);
