-- Ajouter les colonnes de traçabilité manquantes aux leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Créer un enum pour les types de produit
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- RLS pour categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories in their organization"
  ON public.categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = categories.org_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create categories in their organization"
  ON public.categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = categories.org_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update categories in their organization"
  ON public.categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = categories.org_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete categories in their organization"
  ON public.categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = categories.org_id
      AND m.user_id = auth.uid()
    )
  );

-- Ajouter des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS categories_org_idx ON public.categories(org_id);
CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS leads_created_by_idx ON public.leads(created_by);