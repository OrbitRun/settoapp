CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1), 'PARI'));
  RETURN NEW;
END; $function$;

DROP FUNCTION IF EXISTS public.pari_seed_starter_data(uuid);
DROP FUNCTION IF EXISTS public.pari_seed_expense(uuid, uuid, uuid, text, text, bigint, timestamp with time zone, uuid[]);