-- Narrow, non-recursive same-row integrity helper for group_members updates.
CREATE OR REPLACE FUNCTION public.group_member_fields_unchanged(
  _id uuid,
  _group_id uuid,
  _person_id uuid,
  _owner_user_id uuid,
  _role text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.id = _id
      AND gm.group_id IS NOT DISTINCT FROM _group_id
      AND gm.person_id IS NOT DISTINCT FROM _person_id
      AND gm.owner_user_id IS NOT DISTINCT FROM _owner_user_id
      AND gm.role IS NOT DISTINCT FROM _role
  );
$$;

REVOKE ALL ON FUNCTION public.group_member_fields_unchanged(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.group_member_fields_unchanged(uuid, uuid, uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.group_member_fields_unchanged(uuid, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.group_member_fields_unchanged(uuid, uuid, uuid, uuid, text) TO service_role;

-- Replace legacy owner_user_id write authority with durable group ownership.
DROP POLICY IF EXISTS "own group members" ON public.group_members;

CREATE POLICY "durable owner can add group members"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (public.is_durable_group_owner(group_id, auth.uid()));

CREATE POLICY "durable owner can update group members"
ON public.group_members
FOR UPDATE
TO authenticated
USING (public.is_durable_group_owner(group_id, auth.uid()))
WITH CHECK (
  public.is_durable_group_owner(group_id, auth.uid())
  AND public.group_member_fields_unchanged(id, group_id, person_id, owner_user_id, role)
);

CREATE POLICY "durable owner can delete group members"
ON public.group_members
FOR DELETE
TO authenticated
USING (public.is_durable_group_owner(group_id, auth.uid()));