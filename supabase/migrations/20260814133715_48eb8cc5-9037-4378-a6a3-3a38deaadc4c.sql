ALTER TABLE public.group_invitations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.group_invitations
  DROP CONSTRAINT IF EXISTS group_invitations_status_check;

ALTER TABLE public.group_invitations
  ADD CONSTRAINT group_invitations_status_check CHECK (status IN ('active', 'revoked'));

UPDATE public.group_invitations SET status = 'revoked' WHERE revoked_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_invitation_preview(_code text)
 RETURNS TABLE(group_name text, inviter_name text, member_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    g.name,
    COALESCE(pr.display_name, 'PARI'),
    (SELECT COUNT(*)::int FROM public.group_members gm WHERE gm.group_id = g.id)
  FROM public.group_invitations i
  JOIN public.groups g ON g.id = i.group_id
  LEFT JOIN public.profiles pr ON pr.id = i.owner_user_id
  WHERE (i.token = _code OR i.join_code = upper(_code))
    AND i.status = 'active'
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.accept_group_invitation(_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.group_invitations%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_name text;
  v_person_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_invite FROM public.group_invitations i
  WHERE (i.token = _code OR i.join_code = upper(_code))
    AND i.status = 'active'
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = v_invite.group_id;

  SELECT p.id INTO v_person_id
  FROM public.people p
  JOIN public.group_members gm ON gm.person_id = p.id AND gm.group_id = v_group.id
  WHERE p.linked_profile_id = auth.uid()
  LIMIT 1;

  IF v_person_id IS NOT NULL THEN
    RETURN v_group.id;
  END IF;

  SELECT display_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  SELECT p.id INTO v_person_id
  FROM public.people p
  WHERE p.owner_user_id = v_group.owner_user_id
    AND p.linked_profile_id = auth.uid()
  LIMIT 1;

  IF v_person_id IS NULL THEN
    INSERT INTO public.people (owner_user_id, linked_profile_id, name, is_self)
    VALUES (v_group.owner_user_id, auth.uid(), COALESCE(v_name, 'PARI'), false)
    RETURNING id INTO v_person_id;
  END IF;

  INSERT INTO public.group_members (owner_user_id, group_id, person_id, role)
  VALUES (v_group.owner_user_id, v_group.id, v_person_id, 'member');

  RETURN v_group.id;
END;
$function$;