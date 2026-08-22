CREATE OR REPLACE FUNCTION public.is_durable_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    JOIN public.people p
      ON p.id = g.owner_person_id
    JOIN public.group_members gm
      ON gm.group_id = g.id
     AND gm.person_id = g.owner_person_id
     AND gm.removed_at IS NULL
     AND gm.role = 'owner'
    WHERE g.id = _group_id
      AND g.owner_person_id IS NOT NULL
      AND p.linked_profile_id = _user_id
      AND p.status = 'active'
      AND p.unlinked_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_durable_group_owner(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_durable_group_owner(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_durable_group_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_durable_group_owner(uuid, uuid) TO service_role;

DROP POLICY "own groups" ON public.groups;

CREATE POLICY "legacy owner can read group"
  ON public.groups FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "create own groups"
  ON public.groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "durable owner can update group"
  ON public.groups FOR UPDATE TO authenticated
  USING (public.is_durable_group_owner(id, auth.uid()))
  WITH CHECK (public.is_durable_group_owner(id, auth.uid()));

CREATE POLICY "durable owner can delete group"
  ON public.groups FOR DELETE TO authenticated
  USING (public.is_durable_group_owner(id, auth.uid()));