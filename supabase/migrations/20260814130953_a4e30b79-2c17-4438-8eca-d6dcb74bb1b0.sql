DELETE FROM public.people p
WHERE p.is_self = false
  AND EXISTS (
    SELECT 1 FROM public.people s
    WHERE s.owner_user_id = p.owner_user_id
      AND s.is_self = true
      AND s.created_at = p.created_at
      AND lower(s.name) = lower(p.name)
  )
  AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.person_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.paid_by_person_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.expense_splits es WHERE es.person_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.item_splits i WHERE i.person_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.settlements st WHERE st.from_person_id = p.id OR st.to_person_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.activity a WHERE a.actor_person_id = p.id);