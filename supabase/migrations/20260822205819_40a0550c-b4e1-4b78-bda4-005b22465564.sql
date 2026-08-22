CREATE OR REPLACE FUNCTION public.transfer_group_ownership(_group_id uuid, _new_owner_person_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_group public.groups%ROWTYPE;
  v_prev_person public.people%ROWTYPE;
  v_prev_person_id uuid;
  v_new_person public.people%ROWTYPE;
  v_prev_member public.group_members%ROWTYPE;
  v_new_member public.group_members%ROWTYPE;
  v_affected int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _group_id IS NULL OR _new_owner_person_id IS NULL THEN
    RAISE EXCEPTION 'group and successor are required';
  END IF;

  -- Deterministic lock order: group -> people (by id) -> group_members (by person_id).
  SELECT * INTO v_group FROM public.groups g WHERE g.id = _group_id FOR UPDATE;
  IF v_group.id IS NULL THEN
    RAISE EXCEPTION 'group not found';
  END IF;

  -- Transitional authority: both the legacy account key and the durable predicate.
  IF v_group.owner_user_id IS DISTINCT FROM v_uid
     OR public.is_group_owner(_group_id, v_uid) IS NOT TRUE THEN
    RAISE EXCEPTION 'not group owner';
  END IF;

  -- The durable owner path must be healthy before it can be moved. is_group_owner
  -- still has a legacy owner_user_id branch, so it alone does not prove this.
  IF v_group.owner_person_id IS NULL THEN
    RAISE EXCEPTION 'transitional data: group % has no owner_person_id', _group_id;
  END IF;

  v_prev_person_id := v_group.owner_person_id;

  -- Lock both people rows in a single id-ordered statement.
  PERFORM 1 FROM (
    SELECT p.id FROM public.people p
    WHERE p.id IN (v_prev_person_id, _new_owner_person_id)
    ORDER BY p.id
    FOR UPDATE
  ) locked;

  -- Lock both membership rows in a single person_id-ordered statement.
  PERFORM 1 FROM (
    SELECT gm.id FROM public.group_members gm
    WHERE gm.group_id = _group_id
      AND gm.person_id IN (v_prev_person_id, _new_owner_person_id)
      AND gm.removed_at IS NULL
    ORDER BY gm.person_id
    FOR UPDATE
  ) locked;

  SELECT * INTO v_prev_person FROM public.people p WHERE p.id = v_prev_person_id;

  IF v_prev_person.id IS NULL
     OR v_prev_person.status <> 'active'
     OR v_prev_person.unlinked_at IS NOT NULL
     OR v_prev_person.linked_profile_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'transitional data: owner person for group % is inconsistent', _group_id;
  END IF;

  SELECT * INTO v_prev_member
  FROM public.group_members gm
  WHERE gm.group_id = _group_id
    AND gm.person_id = v_prev_person_id
    AND gm.removed_at IS NULL;

  IF v_prev_member.id IS NULL THEN
    RAISE EXCEPTION 'transitional data: owner person is not an active member of group %', _group_id;
  END IF;

  -- Convention: the durable owner's active membership carries role 'owner'.
  -- A mismatch is transitional-data inconsistency, never silently normalized here.
  IF v_prev_member.role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'transitional data: owner membership for group % has role %, expected owner',
      _group_id, v_prev_member.role;
  END IF;

  -- No-op when the successor already owns the group (after full validation).
  IF _new_owner_person_id = v_prev_person_id THEN
    RETURN _group_id;
  END IF;

  SELECT * INTO v_new_person FROM public.people p WHERE p.id = _new_owner_person_id;

  IF v_new_person.id IS NULL THEN
    RAISE EXCEPTION 'successor not found';
  END IF;

  IF v_new_person.status <> 'active'
     OR v_new_person.unlinked_at IS NOT NULL
     OR v_new_person.linked_profile_id IS NULL THEN
    RAISE EXCEPTION 'successor is not an active linked person';
  END IF;

  SELECT * INTO v_new_member
  FROM public.group_members gm
  WHERE gm.group_id = _group_id
    AND gm.person_id = _new_owner_person_id
    AND gm.removed_at IS NULL;

  IF v_new_member.id IS NULL THEN
    RAISE EXCEPTION 'successor is not an active member of this group';
  END IF;

  UPDATE public.groups
  SET owner_person_id = v_new_person.id,
      owner_user_id = v_new_person.linked_profile_id,
      orphaned_at = NULL
  WHERE id = _group_id;

  UPDATE public.group_members gm
  SET role = 'owner'
  WHERE gm.group_id = _group_id
    AND gm.person_id = _new_owner_person_id
    AND gm.removed_at IS NULL;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'successor membership update affected % rows, expected 1', v_affected;
  END IF;

  UPDATE public.group_members gm
  SET role = 'member'
  WHERE gm.group_id = _group_id
    AND gm.person_id = v_prev_person_id
    AND gm.removed_at IS NULL;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'previous owner membership update affected % rows, expected 1', v_affected;
  END IF;

  -- Actor is the caller (the previous owner), captured before the group changed.
  INSERT INTO public.activity (
    owner_user_id, group_id, actor_person_id, activity_type, entity_type, entity_id, metadata
  )
  VALUES (
    v_uid, _group_id, v_prev_person_id, 'ownership_transferred', 'group', _group_id,
    jsonb_build_object(
      'from_person_id', v_prev_person_id,
      'to_person_id', v_new_person.id,
      'title', v_group.name
    )
  );

  RETURN _group_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.transfer_group_ownership(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transfer_group_ownership(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.transfer_group_ownership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_group_ownership(uuid, uuid) TO service_role;