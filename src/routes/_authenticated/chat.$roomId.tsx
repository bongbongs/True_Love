import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/$roomId")({
  head: () => ({ meta: [{ title: "대화 · True Love" }] }),
  component: ChatPage,
});

type Message = { id: string; room_id: string; sender_id: string; content: string; created_at: string };
type Room = { id: string; user1_id: string; user2_id: string; expires_at: string };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function ChatPage() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [other, setOther] = useState<{ display_name: string; avatar_url: string | null } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setMe(u.user.id);

      const { data: r, error: rErr } = await supabase
        .from("chat_rooms").select("id, user1_id, user2_id, expires_at").eq("id", roomId).single();
      if (rErr || !r) {
        toast.error("대화방을 찾을 수 없어요");
        navigate({ to: "/" });
        return;
      }
      if (!active) return;
      setRoom(r);

      const otherId = r.user1_id === u.user.id ? r.user2_id : r.user1_id;
      const { data: prof } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", otherId).single();
      if (active) setOther(prof);

      const { data: msgs } = await supabase
        .from("messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
      if (active) setMessages(msgs ?? []);
    }
    load();
    return () => { active = false; };
  }, [roomId, navigate]);

  // Refresh messages without exposing Realtime channels.
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      if (active && data) setMessages(data);
    };
    const refreshTimer = window.setInterval(refresh, 3_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [roomId]);

  // Countdown
  useEffect(() => {
    if (!room) return;
    const tick = () => {
      const diff = new Date(room.expires_at).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("만료됨"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}시간 ${m}분 남음`);
    };
    tick();
    const i = setInterval(tick, 30000);
    return () => clearInterval(i);
  }, [room]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const expired = room ? new Date(room.expires_at).getTime() <= Date.now() : false;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || !me || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({ room_id: roomId, sender_id: me, content });
    if (error) toast.error(error.message);
    else setInput("");
    setSending(false);
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/90 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <Avatar className="h-8 w-8">
            <AvatarImage src={other?.avatar_url ?? undefined} />
            <AvatarFallback>{other?.display_name?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-sm">{other?.display_name ?? "..."}</div>
            <div className="text-xs text-muted-foreground">{timeLeft}</div>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">대화를 시작해보세요. 자정이 되면 이 방은 닫혀요.</p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`text-[10px] mt-0.5 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={send} className="border-t bg-background p-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={expired ? "이 대화방은 만료되었어요" : "메시지를 입력하세요"}
            disabled={expired || sending}
            maxLength={2000}
          />
          <Button type="submit" size="icon" disabled={expired || sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
