ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;
ALTER PUBLICATION supabase_realtime DROP TABLE public.conversation_requests;
ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_rooms;

REVOKE DELETE ON public.conversation_requests FROM anon, authenticated;