-- Allow legacy team member names to continue working alongside Supabase user IDs
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
    OR EXISTS (
      SELECT 1
      FROM profiles p,
           LATERAL unnest(COALESCE(team_members, ARRAY[]::text[])) AS legacy_member
      WHERE p.user_id = auth.uid()
        AND p.full_name IS NOT NULL
        AND trim(legacy_member) <> ''
        AND lower(legacy_member) = lower(p.full_name)
    )
    OR user_id = auth.uid()
  )
);
