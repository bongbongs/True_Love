
CREATE OR REPLACE FUNCTION public.delete_chat_room(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_rooms
    WHERE id = _room_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Chat room not found or not authorized';
  END IF;
  DELETE FROM public.chat_rooms WHERE id = _room_id;
END;
$$;

DROP POLICY IF EXISTS "Receivers delete own conversation rooms" ON public.chat_rooms;
CREATE POLICY "Members delete own conversation rooms"
ON public.chat_rooms
FOR DELETE
TO authenticated
USING (user1_id = auth.uid() OR user2_id = auth.uid());
