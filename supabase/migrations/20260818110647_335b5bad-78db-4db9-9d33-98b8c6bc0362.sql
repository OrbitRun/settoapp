GRANT EXECUTE ON FUNCTION public.is_group_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pari_touch_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;