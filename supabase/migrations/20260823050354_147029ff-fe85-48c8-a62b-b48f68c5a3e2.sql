CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_my_people uuid[];
  v_owned_groups uuid[];
  v_affected_groups uuid[];
  v_group_id uuid;
  v_my_person uuid;
  v_successor uuid;
  v_successor_uid uuid;
  v_transferred int := 0;
  v_orphaned int := 0;
  v_memberships int := 0;
  v_people_unlinked int := 0;
  v_personal int := 0;
  v_invites int := 0;
  v_placeholders int := 0;
  v_n int;
  v_left int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- people currently linked to the caller
  SELECT COALESCE(array_agg(p.id ORDER BY p.id), '{}')
    INTO v_my_people
  FROM public.people p
  WHERE p.linked_profile_id = v_uid;

  -- groups the caller currently owns (durable or legacy)
  SELECT COALESCE(array_agg(g.id ORDER BY g.id), '{}')
    INTO v_owned_groups
  FROM public.groups g
  WHERE g.owner_user_id = v_uid
     OR (g.owner_person_id IS NOT NULL AND g.owner_person_id = ANY (v_my_people));

  -- all groups touched by this deletion
  SELECT COALESCE(array_agg(DISTINCT gid ORDER BY gid), '{}')
    INTO v_affected_groups
  FROM (
    SELECT unnest(v_owned_groups) AS gid
    UNION
    SELECT gm.group_id FROM public.group_members gm WHERE gm.person_id = ANY (v_my_people)
  ) s;

  -- 1) lock groups by id
  PERFORM 1 FROM (
    SELECT g.id FROM public.groups g
    WHERE g.id = ANY (v_affected_groups)
    ORDER BY g.id FOR UPDATE
  ) l;

  -- 2) lock people by id (caller-linked people + caller-owned rows)
  PERFORM 1 FROM (
    SELECT p.id FROM public.people p
    WHERE p.id = ANY (v_my_people) OR p.owner_user_id = v_uid
    ORDER BY p.id FOR UPDATE
  ) l;

  -- 3) lock memberships
  PERFORM 1 FROM (
    SELECT gm.id FROM public.group_members gm
    WHERE gm.group_id = ANY (v_affected_groups)
    ORDER BY gm.group_id, gm.person_id FOR UPDATE
  ) l;

  -- personal expenses (no group) are private data: delete them
  DELETE FROM public.expenses e
  WHERE e.owner_user_id = v_uid AND e.group_id IS NULL;
  GET DIAGNOSTICS v_personal = ROW_COUNT;

  -- owned groups: transfer to successor or orphan
  FOREACH v_group_id IN ARRAY v_owned_groups LOOP
    SELECT g.owner_person_id INTO v_my_person FROM public.groups g WHERE g.id = v_group_id;
    IF v_my_person IS NULL OR NOT (v_my_person = ANY (v_my_people)) THEN
      SELECT gm.person_id INTO v_my_person
      FROM public.group_members gm
      WHERE gm.group_id = v_group_id AND gm.person_id = ANY (v_my_people)
      ORDER BY gm.joined_at, gm.person_id
      LIMIT 1;
    END IF;

    SELECT p.id, p.linked_profile_id INTO v_successor, v_successor_uid
    FROM public.group_members gm
    JOIN public.people p ON p.id = gm.person_id
    WHERE gm.group_id = v_group_id
      AND gm.removed_at IS NULL
      AND p.status = 'active'
      AND p.unlinked_at IS NULL
      AND p.linked_profile_id IS NOT NULL
      AND p.linked_profile_id <> v_uid
    ORDER BY gm.joined_at, p.id
    LIMIT 1;

    IF v_successor IS NOT NULL THEN
      UPDATE public.groups
      SET owner_person_id = v_successor,
          owner_user_id = v_successor_uid,
          orphaned_at = NULL
      WHERE id = v_group_id;

      UPDATE public.group_members
      SET role = 'owner'
      WHERE group_id = v_group_id AND person_id = v_successor AND removed_at IS NULL;

      UPDATE public.group_members
      SET role = 'member'
      WHERE group_id = v_group_id AND person_id = ANY (v_my_people) AND role <> 'member';

      IF v_my_person IS NOT NULL THEN
        INSERT INTO public.activity (
          owner_user_id, group_id, actor_person_id, activity_type, entity_type, entity_id, metadata
        )
        VALUES (
          NULL, v_group_id, v_my_person, 'ownership_transferred', 'group', v_group_id,
          jsonb_build_object('from_person_id', v_my_person, 'to_person_id', v_successor, 'reason', 'account_deleted')
        );
      END IF;

      v_transferred := v_transferred + 1;
    ELSE
      UPDATE public.groups
      SET owner_person_id = COALESCE(v_my_person, owner_person_id),
          owner_user_id = NULL,
          orphaned_at = COALESCE(orphaned_at, now())
      WHERE id = v_group_id;
      v_orphaned := v_orphaned + 1;
    END IF;
  END LOOP;

  -- memberships of caller-linked people: soft remove everywhere
  UPDATE public.group_members gm
  SET removed_at = COALESCE(gm.removed_at, now())
  WHERE gm.person_id = ANY (v_my_people)
    AND gm.removed_at IS NULL;
  GET DIAGNOSTICS v_memberships = ROW_COUNT;

  -- invitations: revoke active invites for affected groups
  UPDATE public.group_invitations i
  SET status = 'revoked', revoked_at = COALESCE(i.revoked_at, now())
  WHERE i.group_id = ANY (v_affected_groups)
    AND i.status = 'active';
  GET DIAGNOSTICS v_invites = ROW_COUNT;

  -- receipt pointers on retained shared expenses created by the caller
  UPDATE public.expenses e
  SET receipt_image_url = NULL
  WHERE e.owner_user_id = v_uid
    AND e.group_id IS NOT NULL
    AND e.receipt_image_url IS NOT NULL;

  -- creator references on retained shared rows
  UPDATE public.group_invitations SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.group_members SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.expenses SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.expense_items SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.expense_splits SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.item_splits SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.settlements SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.activity SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.groups SET owner_user_id = NULL WHERE owner_user_id = v_uid;

  -- people lifecycle: unlink every person linked to the caller
  UPDATE public.people p
  SET status = 'former',
      unlinked_at = COALESCE(p.unlinked_at, now()),
      linked_profile_id = NULL,
      avatar_url = NULL,
      is_self = false,
      owner_user_id = CASE WHEN p.owner_user_id = v_uid THEN NULL ELSE p.owner_user_id END
  WHERE p.linked_profile_id = v_uid;
  GET DIAGNOSTICS v_people_unlinked = ROW_COUNT;

  -- unused placeholders owned solely by the caller
  DELETE FROM public.people p
  WHERE p.owner_user_id = v_uid
    AND p.linked_profile_id IS NULL
    AND p.is_self = false
    AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.paid_by_person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.expense_splits s WHERE s.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.item_splits s WHERE s.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.settlements s WHERE s.from_person_id = p.id OR s.to_person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.activity a WHERE a.actor_person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.owner_person_id = p.id);
  GET DIAGNOSTICS v_placeholders = ROW_COUNT;

  -- remaining caller-owned people rows that must survive: drop creator reference
  UPDATE public.people SET owner_user_id = NULL WHERE owner_user_id = v_uid;

  -- zero-FK postcondition
  SELECT
    (SELECT count(*) FROM public.people WHERE owner_user_id = v_uid)
  + (SELECT count(*) FROM public.groups WHERE owner_user_id = v_uid)
  + (SELECT count(*) FROM public.group_members WHERE owner_user_id = v_uid)
  + (SELECT count(*) FROM public.group_invitations WHERE owner_user_id = v_uid)
  + (SELECT count(*) FROM public.expenses WHERE owner_user_id = v_uid)
  + (SELECT count(*) FROM public.expense_items WHERE owner_user_id = v_uid)
  + (SELECT count(*) FROM public.expense_splits WHERE owner_user_id = v_uid)
  + (SELECT count(*) FROM public.item_splits WHERE owner_user_id = v_uid)
  + (SELECT count(*) FROM public.settlements WHERE owner_user_id = v_uid)
  + (SELECT count(*) FROM public.activity WHERE owner_user_id = v_uid)
    INTO v_left;

  IF v_left <> 0 THEN
    RAISE EXCEPTION 'account cleanup incomplete: % owner references remain', v_left;
  END IF;

  SELECT count(*) INTO v_n FROM public.people WHERE linked_profile_id = v_uid;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'account cleanup incomplete: % linked people remain', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.expenses WHERE owner_user_id = v_uid AND group_id IS NULL;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'account cleanup incomplete: personal expenses remain';
  END IF;

  RETURN jsonb_build_object(
    'groups_transferred', v_transferred,
    'groups_orphaned', v_orphaned,
    'memberships_removed', v_memberships,
    'people_unlinked', v_people_unlinked,
    'personal_expenses_deleted', v_personal,
    'invitations_revoked', v_invites,
    'placeholders_deleted', v_placeholders,
    'no_op', (v_transferred + v_orphaned + v_memberships + v_people_unlinked
              + v_personal + v_invites + v_placeholders) = 0,
    'ready_for_auth_delete', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated, service_role;