-- 1. Remove leftover seeded demo data (created at the exact moment the profile row was created)
CREATE TEMP TABLE seed_groups AS
SELECT g.id, g.owner_user_id
FROM public.groups g
JOIN public.profiles p ON p.id = g.owner_user_id
WHERE g.created_at = p.created_at
  AND g.name IN ('Bofællesskabet', 'Sommerhus', 'Anna & mig', 'Skiferie');

CREATE TEMP TABLE seed_expenses AS
SELECT e.id FROM public.expenses e WHERE e.group_id IN (SELECT id FROM seed_groups);

DELETE FROM public.item_splits WHERE expense_item_id IN (
  SELECT id FROM public.expense_items WHERE expense_id IN (SELECT id FROM seed_expenses)
);
DELETE FROM public.expense_items WHERE expense_id IN (SELECT id FROM seed_expenses);
DELETE FROM public.expense_splits WHERE expense_id IN (SELECT id FROM seed_expenses);
DELETE FROM public.activity WHERE entity_type = 'expense' AND entity_id IN (SELECT id FROM seed_expenses);
DELETE FROM public.expenses WHERE id IN (SELECT id FROM seed_expenses);

DELETE FROM public.settlements WHERE group_id IN (SELECT id FROM seed_groups);
DELETE FROM public.group_invitations WHERE group_id IN (SELECT id FROM seed_groups);
DELETE FROM public.group_members WHERE group_id IN (SELECT id FROM seed_groups);
DELETE FROM public.activity WHERE group_id IN (SELECT id FROM seed_groups);
DELETE FROM public.groups WHERE id IN (SELECT id FROM seed_groups);

-- Seeded people that nothing genuine references
DELETE FROM public.people pe
USING public.profiles p
WHERE pe.owner_user_id = p.id
  AND pe.created_at = p.created_at
  AND pe.is_self = false
  AND NOT EXISTS (SELECT 1 FROM public.expense_splits s WHERE s.person_id = pe.id)
  AND NOT EXISTS (SELECT 1 FROM public.item_splits s WHERE s.person_id = pe.id)
  AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.paid_by_person_id = pe.id)
  AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.person_id = pe.id)
  AND NOT EXISTS (SELECT 1 FROM public.settlements st WHERE st.from_person_id = pe.id OR st.to_person_id = pe.id)
  AND NOT EXISTS (SELECT 1 FROM public.activity a WHERE a.actor_person_id = pe.id);

-- Orphan activity rows pointing at deleted expenses
DELETE FROM public.activity a
WHERE a.entity_type = 'expense'
  AND a.entity_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = a.entity_id);

-- 2. Drop the old demo seeding functions for good
DROP FUNCTION IF EXISTS public.pari_seed_starter_data(uuid);
DROP FUNCTION IF EXISTS public.pari_seed_expense(uuid, uuid, uuid, text, text, bigint, timestamp with time zone, uuid[]);

-- 3. Every account needs a "me" person
INSERT INTO public.people (owner_user_id, linked_profile_id, name, is_self)
SELECT p.id, p.id, COALESCE(NULLIF(p.display_name, ''), 'Mig'), true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.people pe WHERE pe.owner_user_id = p.id AND pe.is_self
);

-- 4. New accounts get their "me" person at signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1), 'PARI');
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, v_name)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.people (owner_user_id, linked_profile_id, name, is_self)
  VALUES (NEW.id, NEW.id, v_name, true);
  RETURN NEW;
END; $function$;