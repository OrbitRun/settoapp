-- Stage S3B-FIX: restrictive parent-authorization guardrail on shared child tables.
-- Applies to INSERT and UPDATE only. Purely additive: no existing policy, function,
-- grant, FK or column is modified.

-- expense_items -------------------------------------------------------------
CREATE POLICY "child writes require parent authority" ON public.expense_items
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_items.expense_id
        AND e.owner_user_id = auth.uid()
        AND (e.group_id IS NULL OR public.is_group_participant(e.group_id, auth.uid()))
    )
  );

CREATE POLICY "child updates require parent authority" ON public.expense_items
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_items.expense_id
        AND e.owner_user_id = auth.uid()
        AND (e.group_id IS NULL OR public.is_group_participant(e.group_id, auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_items.expense_id
        AND e.owner_user_id = auth.uid()
        AND (e.group_id IS NULL OR public.is_group_participant(e.group_id, auth.uid()))
    )
  );

-- expense_splits ------------------------------------------------------------
CREATE POLICY "child writes require parent authority" ON public.expense_splits
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id
        AND e.owner_user_id = auth.uid()
        AND (e.group_id IS NULL OR public.is_group_participant(e.group_id, auth.uid()))
    )
  );

CREATE POLICY "child updates require parent authority" ON public.expense_splits
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id
        AND e.owner_user_id = auth.uid()
        AND (e.group_id IS NULL OR public.is_group_participant(e.group_id, auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id
        AND e.owner_user_id = auth.uid()
        AND (e.group_id IS NULL OR public.is_group_participant(e.group_id, auth.uid()))
    )
  );

-- item_splits ---------------------------------------------------------------
CREATE POLICY "child writes require parent authority" ON public.item_splits
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.expense_items ei
      JOIN public.expenses e ON e.id = ei.expense_id
      WHERE ei.id = item_splits.expense_item_id
        AND e.owner_user_id = auth.uid()
        AND (e.group_id IS NULL OR public.is_group_participant(e.group_id, auth.uid()))
    )
  );

CREATE POLICY "child updates require parent authority" ON public.item_splits
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.expense_items ei
      JOIN public.expenses e ON e.id = ei.expense_id
      WHERE ei.id = item_splits.expense_item_id
        AND e.owner_user_id = auth.uid()
        AND (e.group_id IS NULL OR public.is_group_participant(e.group_id, auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.expense_items ei
      JOIN public.expenses e ON e.id = ei.expense_id
      WHERE ei.id = item_splits.expense_item_id
        AND e.owner_user_id = auth.uid()
        AND (e.group_id IS NULL OR public.is_group_participant(e.group_id, auth.uid()))
    )
  );