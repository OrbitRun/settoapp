CREATE POLICY "participants can read group settlements"
ON public.settlements
FOR SELECT
TO authenticated
USING (public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "participants can read group activity"
ON public.activity
FOR SELECT
TO authenticated
USING (group_id IS NOT NULL AND public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "participants can read group item splits"
ON public.item_splits
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.expense_items ei
    JOIN public.expenses e ON e.id = ei.expense_id
    WHERE ei.id = item_splits.expense_item_id
      AND e.group_id IS NOT NULL
      AND public.is_group_participant(e.group_id, auth.uid())
      AND (
        ei.is_shared
        OR EXISTS (
          SELECT 1
          FROM public.item_splits s2
          JOIN public.people p ON p.id = s2.person_id
          WHERE s2.expense_item_id = ei.id
            AND p.linked_profile_id = auth.uid()
        )
      )
  )
);