-- ============ PART A: invitations ============
CREATE OR REPLACE FUNCTION public.group_invitation_fields_unchanged(
  _id uuid,
  _group_id uuid,
  _owner_user_id uuid,
  _person_id uuid,
  _token text,
  _join_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_invitations i
    WHERE i.id = _id
      AND i.group_id IS NOT DISTINCT FROM _group_id
      AND i.owner_user_id IS NOT DISTINCT FROM _owner_user_id
      AND i.person_id IS NOT DISTINCT FROM _person_id
      AND i.token IS NOT DISTINCT FROM _token
      AND i.join_code IS NOT DISTINCT FROM _join_code
  );
$$;

REVOKE ALL ON FUNCTION public.group_invitation_fields_unchanged(uuid, uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.group_invitation_fields_unchanged(uuid, uuid, uuid, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.group_invitation_fields_unchanged(uuid, uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.group_invitation_fields_unchanged(uuid, uuid, uuid, uuid, text, text) TO service_role;

DROP POLICY IF EXISTS "own group invitations" ON public.group_invitations;

CREATE POLICY "durable owner can read group invitations"
ON public.group_invitations
FOR SELECT
TO authenticated
USING (public.is_durable_group_owner(group_id, auth.uid()));

CREATE POLICY "durable owner can create group invitations"
ON public.group_invitations
FOR INSERT
TO authenticated
WITH CHECK (public.is_durable_group_owner(group_id, auth.uid()));

CREATE POLICY "durable owner can update group invitations"
ON public.group_invitations
FOR UPDATE
TO authenticated
USING (public.is_durable_group_owner(group_id, auth.uid()))
WITH CHECK (
  public.is_durable_group_owner(group_id, auth.uid())
  AND public.group_invitation_fields_unchanged(id, group_id, owner_user_id, person_id, token, join_code)
);

CREATE POLICY "durable owner can delete group invitations"
ON public.group_invitations
FOR DELETE
TO authenticated
USING (public.is_durable_group_owner(group_id, auth.uid()));

-- ============ PART B: group placeholder people (narrow RPCs only) ============
CREATE OR REPLACE FUNCTION public.rename_group_placeholder(
  _group_id uuid,
  _person_id uuid,
  _name text
)
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_person public.people%ROWTYPE;
  v_name text;
  v_foreign int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF public.is_durable_group_owner(_group_id, v_uid) IS NOT TRUE THEN
    RAISE EXCEPTION 'not group owner';
  END IF;

  v_name := btrim(COALESCE(_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'name must not be empty';
  END IF;

  SELECT * INTO v_person FROM public.people p WHERE p.id = _person_id FOR UPDATE;
  IF v_person.id IS NULL THEN
    RAISE EXCEPTION 'person not found';
  END IF;

  IF v_person.linked_profile_id IS NOT NULL OR v_person.is_self THEN
    RAISE EXCEPTION 'person is linked to an account';
  END IF;

  IF v_person.status <> 'active' OR v_person.unlinked_at IS NOT NULL THEN
    RAISE EXCEPTION 'person is not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = _group_id AND gm.person_id = _person_id
  ) THEN
    RAISE EXCEPTION 'person is not part of this group';
  END IF;

  -- Cross-group safety: never rename a person shared with a group owned by
  -- somebody else.
  SELECT count(*) INTO v_foreign
  FROM public.group_members gm
  JOIN public.groups g ON g.id = gm.group_id
  WHERE gm.person_id = _person_id
    AND gm.group_id <> _group_id
    AND g.owner_person_id IS DISTINCT FROM (SELECT g2.owner_person_id FROM public.groups g2 WHERE g2.id = _group_id);

  IF v_foreign > 0 THEN
    RAISE EXCEPTION 'person is shared with a group owned by another account';
  END IF;

  RETURN QUERY
  UPDATE public.people p SET name = v_name WHERE p.id = _person_id
  RETURNING p.id, p.name;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_group_placeholder(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rename_group_placeholder(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rename_group_placeholder(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_group_placeholder(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_unused_group_placeholder(
  _group_id uuid,
  _person_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_person public.people%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF public.is_durable_group_owner(_group_id, v_uid) IS NOT TRUE THEN
    RAISE EXCEPTION 'not group owner';
  END IF;

  SELECT * INTO v_person FROM public.people p WHERE p.id = _person_id FOR UPDATE;
  IF v_person.id IS NULL THEN
    RAISE EXCEPTION 'person not found';
  END IF;

  IF v_person.linked_profile_id IS NOT NULL OR v_person.is_self THEN
    RAISE EXCEPTION 'person is linked to an account';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = _group_id AND gm.person_id = _person_id
  ) THEN
    RAISE EXCEPTION 'person is not part of this group';
  END IF;

  -- Only a placeholder that exists nowhere else may be removed.
  IF EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.person_id = _person_id AND gm.group_id <> _group_id)
     OR EXISTS (SELECT 1 FROM public.expenses e WHERE e.paid_by_person_id = _person_id)
     OR EXISTS (SELECT 1 FROM public.expense_splits s WHERE s.person_id = _person_id)
     OR EXISTS (SELECT 1 FROM public.item_splits s WHERE s.person_id = _person_id)
     OR EXISTS (SELECT 1 FROM public.settlements s WHERE s.from_person_id = _person_id OR s.to_person_id = _person_id)
     OR EXISTS (SELECT 1 FROM public.activity a WHERE a.actor_person_id = _person_id)
     OR EXISTS (SELECT 1 FROM public.groups g WHERE g.owner_person_id = _person_id) THEN
    RAISE EXCEPTION 'person is referenced by shared history';
  END IF;

  DELETE FROM public.group_members gm WHERE gm.group_id = _group_id AND gm.person_id = _person_id;
  DELETE FROM public.people p WHERE p.id = _person_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_unused_group_placeholder(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_unused_group_placeholder(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_unused_group_placeholder(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_unused_group_placeholder(uuid, uuid) TO service_role;