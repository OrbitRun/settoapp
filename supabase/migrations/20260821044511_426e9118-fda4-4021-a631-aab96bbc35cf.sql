CREATE OR REPLACE FUNCTION public.group_owner_fields_unchanged(
  _group_id uuid,
  _owner_user_id uuid,
  _owner_person_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = _group_id
      AND g.owner_user_id IS NOT DISTINCT FROM _owner_user_id
      AND g.owner_person_id IS NOT DISTINCT FROM _owner_person_id
  );
$$;

REVOKE ALL ON FUNCTION public.group_owner_fields_unchanged(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.group_owner_fields_unchanged(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.group_owner_fields_unchanged(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.group_owner_fields_unchanged(uuid, uuid, uuid) TO service_role;

CREATE POLICY "groups update must be group owner"
ON public.groups AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_group_owner(id, auth.uid()))
WITH CHECK (
  public.is_group_owner(id, auth.uid())
  AND public.group_owner_fields_unchanged(id, owner_user_id, owner_person_id)
);

CREATE POLICY "groups delete must be group owner"
ON public.groups AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.is_group_owner(id, auth.uid()));