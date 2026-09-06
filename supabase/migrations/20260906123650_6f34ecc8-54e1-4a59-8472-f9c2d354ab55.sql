CREATE OR REPLACE FUNCTION public.claim_group_invitation(_code text)
 RETURNS TABLE(status text, group_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.group_invitations%ROWTYPE;
  v_person public.people%ROWTYPE;
  v_member public.group_members%ROWTYPE;
  v_existing uuid;
  v_valid boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT 'unauthenticated'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT * INTO v_invite FROM public.group_invitations i
  WHERE (i.token = _code OR i.join_code = upper(_code))
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Group-wide invitation: unchanged legacy behaviour.
  IF v_invite.person_id IS NULL THEN
    RETURN QUERY SELECT * FROM public.redeem_group_invitation(_code);
    RETURN;
  END IF;

  SELECT * INTO v_person FROM public.people p WHERE p.id = v_invite.person_id FOR UPDATE;

  IF v_person.id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  -- A person invitation only ever REACTIVATES a proven historical membership.
  SELECT * INTO v_member
  FROM public.group_members gm
  WHERE gm.group_id = v_invite.group_id AND gm.person_id = v_person.id
  ORDER BY gm.joined_at
  LIMIT 1
  FOR UPDATE;

  IF v_member.id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  v_valid := v_invite.revoked_at IS NULL
         AND v_invite.status = 'active'
         AND v_invite.expires_at > now();

  -- Already claimed by this same account.
  IF v_person.linked_profile_id = auth.uid() THEN
    IF v_member.removed_at IS NULL THEN
      -- Harmless idempotency: nothing to change.
      RETURN QUERY SELECT 'already_member'::text, v_invite.group_id;
      RETURN;
    END IF;

    -- Membership was removed after the claim. Only a currently valid
    -- invitation may bring it back.
    IF NOT v_valid THEN
      IF v_invite.expires_at <= now() AND v_invite.revoked_at IS NULL AND v_invite.status = 'active' THEN
        RETURN QUERY SELECT 'expired'::text, NULL::uuid;
      ELSE
        RETURN QUERY SELECT 'revoked'::text, NULL::uuid;
      END IF;
      RETURN;
    END IF;

    UPDATE public.group_members gm SET removed_at = NULL WHERE gm.id = v_member.id;
    UPDATE public.people p
    SET status = 'active', unlinked_at = NULL
    WHERE p.id = v_person.id AND (p.status <> 'active' OR p.unlinked_at IS NOT NULL);
    UPDATE public.group_invitations
    SET status = 'used', revoked_at = now()
    WHERE id = v_invite.id;

    RETURN QUERY SELECT 'claimed'::text, v_invite.group_id;
    RETURN;
  END IF;

  IF v_person.linked_profile_id IS NOT NULL THEN
    RETURN QUERY SELECT 'person_taken'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_invite.revoked_at IS NOT NULL OR v_invite.status <> 'active' THEN
    RETURN QUERY SELECT 'revoked'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_invite.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::uuid;
    RETURN;
  END IF;

  -- The caller must not already be another ACTIVE person in this group.
  SELECT p.id INTO v_existing
  FROM public.people p
  JOIN public.group_members gm ON gm.person_id = p.id AND gm.group_id = v_invite.group_id
  WHERE p.linked_profile_id = auth.uid()
    AND gm.removed_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT 'already_member'::text, v_invite.group_id;
    RETURN;
  END IF;

  UPDATE public.people
  SET linked_profile_id = auth.uid(),
      status = 'active',
      unlinked_at = NULL
  WHERE id = v_person.id AND linked_profile_id IS NULL;

  UPDATE public.group_members
  SET removed_at = NULL
  WHERE id = v_member.id;

  UPDATE public.group_invitations
  SET status = 'used', revoked_at = now()
  WHERE id = v_invite.id;

  RETURN QUERY SELECT 'claimed'::text, v_invite.group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  v_deleted_groups int := 0;
  v_memberships int := 0;
  v_people_unlinked int := 0;
  v_personal int := 0;
  v_invites int := 0;
  v_invites_kept int := 0;
  v_n_kept int;
  v_placeholders int := 0;
  v_n int;
  v_left int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT COALESCE(array_agg(p.id ORDER BY p.id), '{}')
    INTO v_my_people
  FROM public.people p
  WHERE p.linked_profile_id = v_uid;

  SELECT COALESCE(array_agg(g.id ORDER BY g.id), '{}')
    INTO v_owned_groups
  FROM public.groups g
  WHERE g.owner_user_id = v_uid
     OR (g.owner_person_id IS NOT NULL AND g.owner_person_id = ANY (v_my_people));

  SELECT COALESCE(array_agg(DISTINCT gid ORDER BY gid), '{}')
    INTO v_affected_groups
  FROM (
    SELECT unnest(v_owned_groups) AS gid
    UNION
    SELECT gm.group_id FROM public.group_members gm WHERE gm.person_id = ANY (v_my_people)
  ) s;

  PERFORM 1 FROM (
    SELECT g.id FROM public.groups g
    WHERE g.id = ANY (v_affected_groups)
    ORDER BY g.id FOR UPDATE
  ) l;

  PERFORM 1 FROM (
    SELECT p.id FROM public.people p
    WHERE p.id = ANY (v_my_people) OR p.owner_user_id = v_uid
    ORDER BY p.id FOR UPDATE
  ) l;

  PERFORM 1 FROM (
    SELECT gm.id FROM public.group_members gm
    WHERE gm.group_id = ANY (v_affected_groups)
    ORDER BY gm.group_id, gm.person_id FOR UPDATE
  ) l;

  DELETE FROM public.expenses e
  WHERE e.owner_user_id = v_uid AND e.group_id IS NULL;
  GET DIAGNOSTICS v_personal = ROW_COUNT;

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

      -- Invitations this account created in the transferred group stay usable
      -- and follow the new owner, except any that point at the departing user.
      UPDATE public.group_invitations i
      SET owner_user_id = v_successor_uid
      WHERE i.group_id = v_group_id
        AND i.owner_user_id = v_uid
        AND i.status = 'active'
        AND i.revoked_at IS NULL
        AND i.expires_at > now()
        AND (i.person_id IS NULL OR NOT (i.person_id = ANY (v_my_people)));
      GET DIAGNOSTICS v_n_kept = ROW_COUNT;
      v_invites_kept := v_invites_kept + v_n_kept;

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
      -- Nobody else has a real account: the group and everything chained to it
      -- (its invitations included) goes away with the account.
      DELETE FROM public.groups WHERE id = v_group_id;
      v_deleted_groups := v_deleted_groups + 1;
    END IF;
  END LOOP;

  UPDATE public.group_members gm
  SET removed_at = COALESCE(gm.removed_at, now())
  WHERE gm.person_id = ANY (v_my_people)
    AND gm.removed_at IS NULL;
  GET DIAGNOSTICS v_memberships = ROW_COUNT;

  -- Narrow rule: only invitations this account still owns, or invitations that
  -- point at one of this account's people, are withdrawn. Invitations created
  -- by other participants in shared groups are never touched.
  UPDATE public.group_invitations i
  SET status = 'revoked', revoked_at = COALESCE(i.revoked_at, now())
  WHERE i.status = 'active'
    AND (i.owner_user_id = v_uid OR i.person_id = ANY (v_my_people));
  GET DIAGNOSTICS v_invites = ROW_COUNT;

  UPDATE public.group_invitations SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.group_members SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.expenses SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.expense_items SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.expense_splits SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.item_splits SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.settlements SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.activity SET owner_user_id = NULL WHERE owner_user_id = v_uid;
  UPDATE public.groups SET owner_user_id = NULL WHERE owner_user_id = v_uid;

  UPDATE public.people p
  SET status = 'former',
      unlinked_at = COALESCE(p.unlinked_at, now()),
      linked_profile_id = NULL,
      avatar_url = NULL,
      is_self = false,
      owner_user_id = CASE WHEN p.owner_user_id = v_uid THEN NULL ELSE p.owner_user_id END
  WHERE p.linked_profile_id = v_uid;
  GET DIAGNOSTICS v_people_unlinked = ROW_COUNT;

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

  UPDATE public.people SET owner_user_id = NULL WHERE owner_user_id = v_uid;

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

  SELECT count(*) INTO v_n FROM public.receipts WHERE owner_user_id = v_uid;

  RETURN jsonb_build_object(
    'groups_transferred', v_transferred,
    'groups_deleted', v_deleted_groups,
    'memberships_removed', v_memberships,
    'people_unlinked', v_people_unlinked,
    'personal_expenses_deleted', v_personal,
    'invitations_revoked', v_invites,
    'invitations_transferred', v_invites_kept,
    'placeholders_deleted', v_placeholders,
    'receipts_remaining', v_n,
    'no_op', (v_transferred + v_deleted_groups + v_memberships + v_people_unlinked
              + v_personal + v_invites + v_invites_kept + v_placeholders) = 0,
    'ready_for_auth_delete', true
  );
END;
$function$;