-- Supprimer l'ancienne politique incorrecte
DROP POLICY IF EXISTS "Users can create projects in their organization" ON public.projects;

-- Créer la politique corrigée avec une référence explicite
CREATE POLICY "Users can create projects in their organization"
ON public.projects
FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT m.org_id
    FROM public.memberships m
    WHERE m.user_id = auth.uid()
  )
);