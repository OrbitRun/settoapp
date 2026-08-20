CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups g
                 WHERE g.id = _group_id AND g.owner_user_id = _user_id);
$$;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "expenses insert must be participant" ON public.expenses
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "expenses update must be participant" ON public.expenses
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()))
WITH CHECK (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "settlements insert must be participant" ON public.settlements
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "settlements update must be participant" ON public.settlements
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_group_participant(group_id, auth.uid()))
WITH CHECK (public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "activity insert must be participant" ON public.activity
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "activity update must be participant" ON public.activity
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()))
WITH CHECK (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "group members insert must be group owner" ON public.group_members
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "group members update must be group owner" ON public.group_members
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_group_owner(group_id, auth.uid()))
WITH CHECK (public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "group members delete must be group owner" ON public.group_members
AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.is_group_owner(group_id, auth.uid()));