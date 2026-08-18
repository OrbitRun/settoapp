-- 1. Idempotent, status-returning invitation redemption
CREATE OR REPLACE FUNCTION public.redeem_group_invitation(_code text)
RETURNS TABLE(status text, group_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite public.group_invitations%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_name text;
  v_person_id uuid;
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

  SELECT * INTO v_group FROM public.groups g WHERE g.id = v_invite.group_id;
  IF v_group.id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Already a member? Idempotent success, regardless of invitation state.
  SELECT p.id INTO v_person_id
  FROM public.people p
  JOIN public.group_members gm ON gm.person_id = p.id AND gm.group_id = v_group.id
  WHERE p.linked_profile_id = auth.uid()
  LIMIT 1;

  IF v_person_id IS NOT NULL OR v_group.owner_user_id = auth.uid() THEN
    RETURN QUERY SELECT 'already_member'::text, v_group.id;
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

  SELECT pr.display_name INTO v_name FROM public.profiles pr WHERE pr.id = auth.uid();

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
  VALUES (v_group.owner_user_id, v_group.id, v_person_id, 'member')
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT 'joined'::text, v_group.id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_group_invitation(text) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_group_invitation(text) TO authenticated;

-- Prevent duplicate memberships at the data level as well.
CREATE UNIQUE INDEX IF NOT EXISTS group_members_group_person_key
  ON public.group_members (group_id, person_id);

-- 2. Receipt line privacy: participants only see shared lines, or lines
--    explicitly allocated to them.
DROP POLICY IF EXISTS "participants can read group expense items" ON public.expense_items;

CREATE POLICY "participants can read shared group expense items"
ON public.expense_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_items.expense_id
      AND e.group_id IS NOT NULL
      AND public.is_group_participant(e.group_id, auth.uid())
  )
  AND (
    expense_items.is_shared
    OR EXISTS (
      SELECT 1
      FROM public.item_splits s
      JOIN public.people p ON p.id = s.person_id
      WHERE s.expense_item_id = expense_items.id
        AND p.linked_profile_id = auth.uid()
    )
  )
);
