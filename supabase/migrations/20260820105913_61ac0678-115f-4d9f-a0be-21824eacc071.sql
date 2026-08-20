CREATE OR REPLACE FUNCTION public.can_read_expense_item(_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.expense_items ei
    JOIN public.expenses e ON e.id = ei.expense_id
    WHERE ei.id = _item_id
      AND e.group_id IS NOT NULL
      AND public.is_group_participant(e.group_id, auth.uid())
      AND (
        ei.is_shared
        OR EXISTS (
          SELECT 1 FROM public.item_splits s
          JOIN public.people p ON p.id = s.person_id
          WHERE s.expense_item_id = ei.id AND p.linked_profile_id = auth.uid()
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_expense_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_expense_item(uuid) TO authenticated;

DROP POLICY "participants can read group item splits" ON public.item_splits;
CREATE POLICY "participants can read group item splits"
ON public.item_splits FOR SELECT TO authenticated
USING (public.can_read_expense_item(expense_item_id));