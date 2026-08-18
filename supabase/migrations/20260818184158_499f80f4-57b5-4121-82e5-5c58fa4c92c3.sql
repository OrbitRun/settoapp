ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS removed_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_group_participant(_group_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = _group_id AND g.owner_user_id = _user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.people p ON p.id = gm.person_id
    WHERE gm.group_id = _group_id
      AND gm.removed_at IS NULL
      AND p.linked_profile_id = _user_id
  );
$function$;