
-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  bio text DEFAULT '',
  avatar_url text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated
  USING (is_public = true OR id = auth.uid());

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Conversation Requests
CREATE TABLE public.conversation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  request_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Seoul')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (sender_id, request_date),
  CHECK (sender_id <> receiver_id)
);

GRANT SELECT, INSERT, UPDATE ON public.conversation_requests TO authenticated;
GRANT ALL ON public.conversation_requests TO service_role;
ALTER TABLE public.conversation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own requests"
  ON public.conversation_requests FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users send requests"
  ON public.conversation_requests FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Receivers respond to requests"
  ON public.conversation_requests FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid());

-- Chat Rooms
CREATE TABLE public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.conversation_requests(id) ON DELETE SET NULL,
  user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active_date date NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.chat_rooms TO authenticated;
GRANT ALL ON public.chat_rooms TO service_role;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see own rooms"
  ON public.chat_rooms FOR SELECT TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- Helper: check room membership
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_rooms
    WHERE id = _room_id AND (user1_id = _user_id OR user2_id = _user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_room_active(_room_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_rooms WHERE id = _room_id AND expires_at > now());
$$;

-- Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see room messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

CREATE POLICY "Members send messages to active rooms"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_room_member(room_id, auth.uid())
    AND public.is_room_active(room_id)
  );

CREATE INDEX messages_room_id_created_at_idx ON public.messages (room_id, created_at);
CREATE INDEX requests_receiver_idx ON public.conversation_requests (receiver_id, status);

-- Accept request RPC: atomically updates request and creates chat_room
CREATE OR REPLACE FUNCTION public.accept_request(_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.conversation_requests%ROWTYPE;
  v_room_id uuid;
  v_expires timestamptz;
BEGIN
  SELECT * INTO v_req FROM public.conversation_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.receiver_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request already responded'; END IF;

  -- expires at next KST midnight
  v_expires := ((now() AT TIME ZONE 'Asia/Seoul')::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul';

  UPDATE public.conversation_requests
    SET status = 'accepted', responded_at = now()
    WHERE id = _request_id;

  INSERT INTO public.chat_rooms (request_id, user1_id, user2_id, active_date, expires_at)
  VALUES (_request_id, v_req.sender_id, v_req.receiver_id, (now() AT TIME ZONE 'Asia/Seoul')::date, v_expires)
  RETURNING id INTO v_room_id;

  RETURN v_room_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.accept_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversation_requests
    SET status = 'declined', responded_at = now()
    WHERE id = _request_id AND receiver_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Cannot decline'; END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.decline_request(uuid) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
