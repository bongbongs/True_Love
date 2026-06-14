REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.is_room_member(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.is_room_active(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.is_room_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_room_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_room_active(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.accept_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_request(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_request(uuid) TO authenticated, service_role;