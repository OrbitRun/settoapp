REVOKE ALL ON FUNCTION public.pari_seed_expense(uuid, uuid, uuid, text, text, bigint, timestamptz, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pari_seed_starter_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;