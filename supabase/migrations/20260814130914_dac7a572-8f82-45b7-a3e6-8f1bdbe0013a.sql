GRANT EXECUTE ON FUNCTION public.is_group_participant(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(text) TO authenticated, service_role;