-- Update the SELECT policy for sites table to allow users to see sites they created
DROP POLICY IF EXISTS "Users can view their assigned sites or all if admin" ON public.sites;

CREATE POLICY "Users can view their assigned sites or all if admin" 
ON public.sites 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM memberships m
    WHERE m.org_id = sites.org_id 
    AND m.user_id = auth.uid()
  ) 
  AND (
    is_admin(auth.uid(), org_id) 
    OR (auth.uid())::text = ANY (team_members)
    OR user_id = auth.uid()  -- Allow users to see sites they created
  )
);