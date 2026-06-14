CREATE POLICY "Receivers create rooms for accepted requests"
ON public.chat_rooms
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.conversation_requests r
    WHERE r.id = request_id
      AND r.receiver_id = auth.uid()
      AND r.status = 'accepted'
      AND r.sender_id = user1_id
      AND r.receiver_id = user2_id
  )
);

ALTER FUNCTION public.accept_request(uuid) SECURITY INVOKER;
ALTER FUNCTION public.decline_request(uuid) SECURITY INVOKER;