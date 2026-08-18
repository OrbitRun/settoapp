REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.pari_touch_updated_at() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_group_participant(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_group_invitation(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(text) TO authenticated;
REVOKE ALL ON FUNCTION public.redeem_group_invitation(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_group_invitation(text) TO authenticated;
-- Preview stays callable before sign-in: it exposes only group name, inviter name and member count.
REVOKE ALL ON FUNCTION public.get_invitation_preview(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon, authenticated;