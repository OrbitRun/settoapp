CREATE TABLE public.group_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  join_code text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '14 days'),
  revoked_at timestamp with time zone
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invitations TO authenticated;
GRANT ALL ON public.group_invitations TO service_role;

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own group invitations"
  ON public.group_invitations FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE TRIGGER group_invitations_touch
  BEFORE UPDATE ON public.group_invitations
  FOR EACH ROW EXECUTE FUNCTION public.pari_touch_updated_at();

-- Is this user allowed to see the group (owner, or joined via an invitation)?
CREATE OR REPLACE FUNCTION public.is_group_participant(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = _group_id AND g.owner_user_id = _user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.people p ON p.id = gm.person_id
    WHERE gm.group_id = _group_id AND p.linked_profile_id = _user_id
  );
$$;

CREATE POLICY "participants can read groups"
  ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_participant(id, auth.uid()));

CREATE POLICY "participants can read group members"
  ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "participants can read group expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (group_id IS NOT NULL AND public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "participants can read group expense items"
  ON public.expense_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_id
      AND e.group_id IS NOT NULL
      AND public.is_group_participant(e.group_id, auth.uid())
  ));

CREATE POLICY "participants can read group expense splits"
  ON public.expense_splits FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_id
      AND e.group_id IS NOT NULL
      AND public.is_group_participant(e.group_id, auth.uid())
  ));

CREATE POLICY "participants can read group people"
  ON public.people FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.person_id = people.id
      AND public.is_group_participant(gm.group_id, auth.uid())
  ));

-- Public, minimal preview of an invitation (no group contents).
CREATE OR REPLACE FUNCTION public.get_invitation_preview(_code text)
RETURNS TABLE (group_name text, inviter_name text, member_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.name,
    COALESCE(pr.display_name, 'PARI'),
    (SELECT COUNT(*)::int FROM public.group_members gm WHERE gm.group_id = g.id)
  FROM public.group_invitations i
  JOIN public.groups g ON g.id = i.group_id
  LEFT JOIN public.profiles pr ON pr.id = i.owner_user_id
  WHERE (i.token = _code OR i.join_code = upper(_code))
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon, authenticated;

-- Accept an invitation as the signed-in user.
CREATE OR REPLACE FUNCTION public.accept_group_invitation(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.accept_group_invitation(text) TO authenticated;