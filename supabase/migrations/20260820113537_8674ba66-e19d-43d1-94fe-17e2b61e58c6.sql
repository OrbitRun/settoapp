-- Stage S3B: durable, group-anchored write path for shared expense child rows.
-- Additive only. No existing policy, function, grant, FK, column or row is touched.
--
-- Authorization predicate ("legitimate authority to modify the parent expense"
-- under the CURRENT application model):
--   the parent expense is group-scoped  (e.group_id IS NOT NULL)
--   AND the caller currently holds write authority over that expense
--       (e.owner_user_id = auth.uid()  -- the only permissive write path on expenses today)
--   AND the caller is still an active participant of that group
--       (is_group_participant(e.group_id, auth.uid()) -- mirrors the restrictive layer on expenses)
-- This is exactly the authority the caller already has over the parent, so no
-- access is widened. What changes is the anchor: child writes no longer depend
-- on the CHILD row's own owner_user_id, so a NULL creator on a child row can no
-- longer strand a legitimate edit.

CREATE POLICY "participants can write group expense items"
  ON public.expense_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_items.expense_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ));

CREATE POLICY "participants can update group expense items"
  ON public.expense_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_items.expense_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_items.expense_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ));

CREATE POLICY "participants can delete group expense items"
  ON public.expense_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_items.expense_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ));

CREATE POLICY "participants can write group expense splits"
  ON public.expense_splits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_splits.expense_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ));

CREATE POLICY "participants can update group expense splits"
  ON public.expense_splits FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_splits.expense_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_splits.expense_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ));

CREATE POLICY "participants can delete group expense splits"
  ON public.expense_splits FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_splits.expense_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ));

CREATE POLICY "participants can write group item splits"
  ON public.item_splits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expense_items ei
    JOIN public.expenses e ON e.id = ei.expense_id
    WHERE ei.id = item_splits.expense_item_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ));

CREATE POLICY "participants can update group item splits"
  ON public.item_splits FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expense_items ei
    JOIN public.expenses e ON e.id = ei.expense_id
    WHERE ei.id = item_splits.expense_item_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expense_items ei
    JOIN public.expenses e ON e.id = ei.expense_id
    WHERE ei.id = item_splits.expense_item_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ));

CREATE POLICY "participants can delete group item splits"
  ON public.item_splits FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expense_items ei
    JOIN public.expenses e ON e.id = ei.expense_id
    WHERE ei.id = item_splits.expense_item_id
      AND e.group_id IS NOT NULL
      AND e.owner_user_id = auth.uid()
      AND public.is_group_participant(e.group_id, auth.uid())
  ));