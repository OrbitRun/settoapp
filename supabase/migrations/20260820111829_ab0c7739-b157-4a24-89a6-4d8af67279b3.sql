ALTER TABLE public.groups ADD COLUMN owner_person_id uuid NULL;
ALTER TABLE public.groups ADD COLUMN orphaned_at timestamptz NULL;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_owner_person_id_fkey
  FOREIGN KEY (owner_person_id) REFERENCES public.people(id) ON DELETE SET NULL;

UPDATE public.groups g
SET owner_person_id = c.person_id
FROM (
  SELECT gm.group_id, min(p.id::text)::uuid AS person_id, count(*) AS n
  FROM public.people p
  JOIN public.group_members gm ON gm.person_id = p.id
  JOIN public.groups g2 ON g2.id = gm.group_id
  WHERE p.linked_profile_id = g2.owner_user_id
  GROUP BY gm.group_id
) c
WHERE c.group_id = g.id AND c.n = 1;