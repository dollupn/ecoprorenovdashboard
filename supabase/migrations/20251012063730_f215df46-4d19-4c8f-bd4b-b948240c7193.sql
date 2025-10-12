-- Supprimer toutes les politiques RLS existantes sur projects
DROP POLICY IF EXISTS "Users can create projects in their organization" ON public.projects;
DROP POLICY IF EXISTS "Users can view their assigned projects or all if admin" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects in their organization" ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects in their organization" ON public.projects;

-- Politique pour INSERT
CREATE POLICY "Users can create projects in their organization"
ON public.projects
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = projects.org_id
      AND m.user_id = auth.uid()
  )
);

-- Politique pour SELECT - tous les membres de l'org peuvent voir les projets
CREATE POLICY "Users can view projects in their organization"
ON public.projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = projects.org_id
      AND m.user_id = auth.uid()
  )
);

-- Politique pour UPDATE
CREATE POLICY "Users can update projects in their organization"
ON public.projects
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = projects.org_id
      AND m.user_id = auth.uid()
  )
);

-- Politique pour DELETE
CREATE POLICY "Users can delete projects in their organization"
ON public.projects
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = projects.org_id
      AND m.user_id = auth.uid()
  )
);