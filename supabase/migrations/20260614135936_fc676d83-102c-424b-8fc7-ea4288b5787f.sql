ALTER FUNCTION public.delete_received_conversation(uuid) SECURITY INVOKER;

GRANT DELETE ON public.chat_rooms TO authenticated;
GRANT DELETE ON public.conversation_requests TO authenticated;

CREATE POLICY "Receivers delete own conversation rooms"
ON public.chat_rooms
FOR DELETE
TO authenticated
USING (
  user2_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.conversation_requests r
    WHERE r.id = chat_rooms.request_id
      AND r.receiver_id = auth.uid()
  )
);

CREATE POLICY "Receivers delete received requests"
ON public.conversation_requests
FOR DELETE
TO authenticated
USING (receiver_id = auth.uid());