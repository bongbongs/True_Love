REVOKE UPDATE ON public.conversation_requests FROM authenticated;
GRANT UPDATE (status, responded_at) ON public.conversation_requests TO authenticated;

DROP POLICY "Receivers respond to requests" ON public.conversation_requests;
CREATE POLICY "Receivers respond to pending requests"
ON public.conversation_requests
FOR UPDATE
TO authenticated
USING (receiver_id = auth.uid() AND status = 'pending')
WITH CHECK (receiver_id = auth.uid() AND status IN ('accepted', 'declined'));

DROP POLICY "Receivers create rooms for accepted requests" ON public.chat_rooms;
CREATE POLICY "Receivers create rooms for accepted requests"
ON public.chat_rooms
FOR INSERT
TO authenticated
WITH CHECK (
  user2_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.conversation_requests r
    WHERE r.id = request_id
      AND r.receiver_id = auth.uid()
      AND r.status = 'accepted'
      AND r.sender_id = user1_id
      AND r.receiver_id = user2_id
  )
);