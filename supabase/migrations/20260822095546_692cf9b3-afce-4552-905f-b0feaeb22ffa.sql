CREATE OR REPLACE FUNCTION public.create_group(
  _name text,
  _default_split_type text,
  _person_names text[] DEFAULT '{}',
  _percentages jsonb DEFAULT '{}'::jsonb,
  _shares jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_self_id uuid;
  v_self_count int;
  v_display_name text;
  v_currency text;
  v_group_id uuid;
  v_raw text;
  v_trimmed text;
  v_key text;
  v_person_id uuid;
  v_member_ids uuid[] := '{}';
  v_member_keys text[] := '{}';
  i int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _default_split_type IS NULL OR _default_split_type NOT IN ('equal', 'percentage', 'shares') THEN
    RAISE EXCEPTION 'invalid default_split_type';
  END IF;

  -- Owner person: the caller's own active, linked self person.
  SELECT count(*) INTO v_self_count
  FROM public.people p
  WHERE p.linked_profile_id = v_uid
    AND p.status = 'active'
    AND p.unlinked_at IS NULL
    AND p.is_self = true;

  IF v_self_count > 1 THEN
    RAISE EXCEPTION 'ambiguous self person for account %', v_uid;
  END IF;

  SELECT p.id INTO v_self_id
  FROM public.people p
  WHERE p.linked_profile_id = v_uid
    AND p.status = 'active'
    AND p.unlinked_at IS NULL
    AND p.is_self = true;

  SELECT pr.display_name, pr.currency INTO v_display_name, v_currency
  FROM public.profiles pr WHERE pr.id = v_uid;

  IF v_display_name IS NULL THEN
    RAISE EXCEPTION 'missing profile for account %', v_uid;
  END IF;

  IF v_self_id IS NULL THEN
    INSERT INTO public.people (owner_user_id, linked_profile_id, name, is_self)
    VALUES (v_uid, v_uid, v_display_name, true)
    RETURNING id INTO v_self_id;
  END IF;

  INSERT INTO public.groups (owner_user_id, owner_person_id, name, default_split_type, currency)
  VALUES (
    v_uid,
    v_self_id,
    COALESCE(NULLIF(btrim(COALESCE(_name, '')), ''), 'Ny gruppe'),
    _default_split_type,
    COALESCE(v_currency, 'DKK')
  )
  RETURNING id INTO v_group_id;

  v_member_ids := array_append(v_member_ids, v_self_id);
  v_member_keys := array_append(v_member_keys, 'self');

  FOREACH v_raw IN ARRAY COALESCE(_person_names, '{}'::text[]) LOOP
    v_trimmed := btrim(COALESCE(v_raw, ''));
    CONTINUE WHEN v_trimmed = '';
    v_key := lower(v_trimmed);

    -- Reuse an already-visible person, exactly as the client did: first match by
    -- creation order among people the caller can see.
    SELECT p.id INTO v_person_id
    FROM public.people p
    WHERE lower(p.name) = v_key
      AND (
        p.owner_user_id = v_uid
        OR p.linked_profile_id = v_uid
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.person_id = p.id
            AND public.is_group_participant(gm.group_id, v_uid)
        )
      )
      AND p.created_at < now()
    ORDER BY p.created_at
    LIMIT 1;

    IF v_person_id IS NOT NULL THEN
      IF v_person_id = ANY (v_member_ids) THEN
        v_person_id := NULL;
        CONTINUE;
      END IF;
    ELSE
      INSERT INTO public.people (owner_user_id, name)
      VALUES (v_uid, v_trimmed)
      RETURNING id INTO v_person_id;
    END IF;

    v_member_ids := array_append(v_member_ids, v_person_id);
    v_member_keys := array_append(v_member_keys, v_key);
    v_person_id := NULL;
  END LOOP;

  FOR i IN 1 .. array_length(v_member_ids, 1) LOOP
    INSERT INTO public.group_members (
      owner_user_id, group_id, person_id, role, default_percentage, default_weight
    )
    VALUES (
      v_uid,
      v_group_id,
      v_member_ids[i],
      CASE WHEN i = 1 THEN 'owner' ELSE 'member' END,
      CASE
        WHEN _default_split_type = 'percentage'
          THEN (COALESCE(_percentages, '{}'::jsonb) ->> v_member_keys[i])::numeric
        ELSE NULL
      END,
      CASE
        WHEN _default_split_type = 'shares'
          THEN COALESCE((COALESCE(_shares, '{}'::jsonb) ->> v_member_keys[i])::numeric, 1)
        ELSE NULL
      END
    );
  END LOOP;

  INSERT INTO public.activity (
    owner_user_id, group_id, actor_person_id, activity_type, entity_type, entity_id, metadata
  )
  VALUES (
    v_uid, v_group_id, v_self_id, 'group_created', 'group', v_group_id,
    jsonb_build_object('title', _name)
  );

  RETURN v_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_group(text, text, text[], jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_group(text, text, text[], jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_group(text, text, text[], jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group(text, text, text[], jsonb, jsonb) TO service_role;