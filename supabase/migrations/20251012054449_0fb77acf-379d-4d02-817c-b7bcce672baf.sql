-- Créer une table pour gérer plusieurs produits par projet
CREATE TABLE IF NOT EXISTS public.project_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.product_catalog(id) ON DELETE CASCADE,
  quantity NUMERIC DEFAULT 1,
  dynamic_params JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, product_id)
);

-- Activer RLS
ALTER TABLE public.project_products ENABLE ROW LEVEL SECURITY;

-- Politiques RLS - Les utilisateurs peuvent voir les produits des projets de leur organisation
CREATE POLICY "Users can view project products in their organization"
ON public.project_products
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE p.id = project_products.project_id
      AND m.user_id = auth.uid()
  )
);

-- Les utilisateurs peuvent créer des produits pour les projets de leur organisation
CREATE POLICY "Users can create project products in their organization"
ON public.project_products
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE p.id = project_products.project_id
      AND m.user_id = auth.uid()
  )
);

-- Les utilisateurs peuvent mettre à jour les produits des projets de leur organisation
CREATE POLICY "Users can update project products in their organization"
ON public.project_products
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE p.id = project_products.project_id
      AND m.user_id = auth.uid()
  )
);

-- Les utilisateurs peuvent supprimer les produits des projets de leur organisation
CREATE POLICY "Users can delete project products in their organization"
ON public.project_products
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE p.id = project_products.project_id
      AND m.user_id = auth.uid()
  )
);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_project_products_updated_at
BEFORE UPDATE ON public.project_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();