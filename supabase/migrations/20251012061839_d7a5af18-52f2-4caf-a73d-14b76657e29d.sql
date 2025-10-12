-- Supprimer l'ancienne politique
DROP POLICY IF EXISTS "Users can create projects in their organization" ON public.projects;

-- Recréer la politique correctement - utiliser NEW.org_id au lieu de projects.org_id
CREATE POLICY "Users can create projects in their organization"
ON public.projects
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE memberships.org_id = org_id
      AND memberships.user_id = auth.uid()
  )
);