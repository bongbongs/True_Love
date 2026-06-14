CREATE OR REPLACE FUNCTION public.delete_received_conversation(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_requests
    WHERE id = _request_id
      AND receiver_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Conversation not found or not authorized';
  END IF;

  DELETE FROM public.chat_rooms
  WHERE request_id = _request_id
    AND user2_id = auth.uid();

  DELETE FROM public.conversation_requests
  WHERE id = _request_id
    AND receiver_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_received_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_received_conversation(uuid) TO authenticated, service_role;