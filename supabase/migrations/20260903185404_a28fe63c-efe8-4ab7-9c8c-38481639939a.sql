CREATE POLICY "participants can delete group expenses"
ON public.expenses
FOR DELETE
TO authenticated
USING (group_id IS NOT NULL AND public.is_group_participant(group_id, auth.uid()));