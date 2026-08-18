ALTER TABLE public.group_invitations
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS group_invitations_active_person_idx
  ON public.group_invitations (person_id)
  WHERE person_id IS NOT NULL AND status = 'active' AND revoked_at IS NULL;

DROP FUNCTION IF EXISTS public.get_invitation_preview(text);

CREATE FUNCTION public.get_invitation_preview(_code text)
RETURNS TABLE(group_name text, inviter_name text, member_count integer, person_id uuid, person_name text, person_claimed boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    g.name,
    COALESCE(pr.display_name, 'PARI'),
    (SELECT COUNT(*)::int FROM public.group_members gm WHERE gm.group_id = g.id),
    p.id,
    p.name,
    (p.id IS NOT NULL AND p.linked_profile_id IS NOT NULL)
  FROM public.group_invitations i
  JOIN public.groups g ON g.id = i.group_id
  LEFT JOIN public.profiles pr ON pr.id = i.owner_user_id
  LEFT JOIN public.people p ON p.id = i.person_id
  WHERE (i.token = _code OR i.join_code = upper(_code))
    AND i.status = 'active'
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.claim_group_invitation(_code text)
RETURNS TABLE(status text, group_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite public.group_invitations%ROWTYPE;
  v_person public.people%ROWTYPE;
  v_existing uuid;
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

  SELECT * INTO v_person FROM public.people p WHERE p.id = v_invite.person_id;

  IF v_person.id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  -- The person must actually belong to the invitation's group.
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = v_invite.group_id AND gm.person_id = v_person.id
  ) THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Already claimed by this same account: idempotent success.
  IF v_person.linked_profile_id = auth.uid() THEN
    RETURN QUERY SELECT 'already_member'::text, v_invite.group_id;
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

  -- The caller must not already be another person in this group.
  SELECT p.id INTO v_existing
  FROM public.people p
  JOIN public.group_members gm ON gm.person_id = p.id AND gm.group_id = v_invite.group_id
  WHERE p.linked_profile_id = auth.uid()
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT 'already_member'::text, v_invite.group_id;
    RETURN;
  END IF;

  UPDATE public.people
  SET linked_profile_id = auth.uid()
  WHERE id = v_person.id AND linked_profile_id IS NULL;

  UPDATE public.group_invitations
  SET status = 'used', revoked_at = now()
  WHERE id = v_invite.id;

  RETURN QUERY SELECT 'claimed'::text, v_invite.group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_group_invitation(text) TO authenticated;