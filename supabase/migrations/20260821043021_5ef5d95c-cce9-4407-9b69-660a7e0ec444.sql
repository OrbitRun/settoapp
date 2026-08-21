CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    -- Legacy path: the account that created the group.
    SELECT 1 FROM public.groups g
    WHERE g.id = _group_id AND g.owner_user_id = _user_id
  ) OR EXISTS (
    -- Durable path: the group's owner person, still valid and still a member.
    SELECT 1
    FROM public.groups g
    JOIN public.people p ON p.id = g.owner_person_id
    JOIN public.group_members gm
      ON gm.group_id = g.id
     AND gm.person_id = p.id
     AND gm.removed_at IS NULL
    WHERE g.id = _group_id
      AND g.owner_person_id IS NOT NULL
      AND p.linked_profile_id = _user_id
      AND p.status = 'active'
      AND p.unlinked_at IS NULL
  );
$function$;