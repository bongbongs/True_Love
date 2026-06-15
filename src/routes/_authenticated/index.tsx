import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, MessageCircle, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "사람들 · True Love" }] }),
  component: PeoplePage,
});

type Profile = {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  region_city: string | null;
  region_district: string | null;
};

const REGION_STORAGE_KEY = "truelove:lastRegion";
const ALL_REGIONS = "__all__";

function todayKST(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function PeoplePage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [todaySent, setTodaySent] = useState<{ receiver_id: string; status: string; id: string } | null>(null);
  const [activeRooms, setActiveRooms] = useState<Record<string, string>>({}); // other_user_id -> room_id
  const [target, setTarget] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setMe(u.user.id);

      const [{ data: profiles }, { data: requests }, { data: rooms }] = await Promise.all([
        supabase.from("profiles").select("id, display_name, bio, avatar_url").eq("is_public", true).neq("id", u.user.id),
        supabase.from("conversation_requests").select("id, receiver_id, status").eq("sender_id", u.user.id).eq("request_date", todayKST()).maybeSingle(),
        supabase.from("chat_rooms").select("id, user1_id, user2_id, expires_at").gt("expires_at", new Date().toISOString()),
      ]);

      setPeople(profiles ?? []);
      setTodaySent(requests ?? null);
      const map: Record<string, string> = {};
      (rooms ?? []).forEach((r: { id: string; user1_id: string; user2_id: string }) => {
        const other = r.user1_id === u.user!.id ? r.user2_id : r.user1_id;
        map[other] = r.id;
      });
      setActiveRooms(map);
      setLoading(false);
    }
    load();
  }, []);

  async function sendRequest() {
    if (!target) return;
    setSending(true);
    try {
      const { data, error } = await supabase
        .from("conversation_requests")
        .insert({ sender_id: me!, receiver_id: target.id, message: message.trim() })
        .select("id, receiver_id, status")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("오늘은 이미 신청을 보냈어요. 내일 다시 시도해주세요.");
        throw error;
      }
      setTodaySent(data);
      toast.success(`${target.display_name}님에게 신청을 보냈어요`);
      setTarget(null);
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "신청 실패");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto p-6 text-center text-muted-foreground">불러오는 중...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold tracking-tight">오늘은 누구와 대화할까요?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {todaySent ? (
            todaySent.status === "pending" ? "오늘의 신청을 보냈어요. 응답을 기다려요." :
            todaySent.status === "accepted" ? "오늘의 신청이 수락됐어요!" :
            "오늘의 신청이 거절됐어요. 내일 다시 시도해주세요."
          ) : "하루 단 한번, 신중한 대화 신청으로 여러분의 진정한 사랑을 찾아보세요."}
        </p>
      </div>

      {people.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">아직 다른 사용자가 없어요</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {people.map((p) => {
            const room = activeRooms[p.id];
            const alreadySent = todaySent?.receiver_id === p.id;
            return (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback>{p.display_name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.display_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.bio || "한 줄 소개가 없어요"}</div>
                  </div>
                  {room ? (
                    <Button size="sm" onClick={() => navigate({ to: "/chat/$roomId", params: { roomId: room } })}>
                      <MessageCircle className="h-4 w-4 mr-1" />대화
                    </Button>
                  ) : alreadySent ? (
                    <Button size="sm" variant="secondary" disabled>신청 완료</Button>
                  ) : (
                    <Button size="sm" disabled={!!todaySent} onClick={() => setTarget(p)}>
                      <Sparkles className="h-4 w-4 mr-1" />신청
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.display_name}님에게 대화 신청</DialogTitle>
            <DialogDescription>오늘의 단 한 번뿐인 신청이에요. 짧은 인사말을 남겨보세요.</DialogDescription>
          </DialogHeader>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="안녕하세요!" maxLength={300} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>취소</Button>
            <Button onClick={sendRequest} disabled={sending}>{sending ? "보내는 중..." : "신청 보내기"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
