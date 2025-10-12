-- Ajouter une politique pour permettre aux membres d'une organisation de voir les profils des autres membres
CREATE POLICY "Members can view profiles of other org members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m1
    JOIN public.memberships m2 ON m1.org_id = m2.org_id
    WHERE m1.user_id = auth.uid()
    AND m2.user_id = profiles.user_id
  )
);