import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "대화 기록 · True Love" }] }),
  component: HistoryPage,
});

type Row = {
  id: string;
  active_date: string;
  expires_at: string;
  other_id: string;
  last_message: string | null;
  last_at: string | null;
  other: { display_name: string; avatar_url: string | null } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const me = u.user.id;
    const { data: rooms, error } = await supabase
      .from("chat_rooms")
      .select("id, active_date, expires_at, user1_id, user2_id")
      .or(`user1_id.eq.${me},user2_id.eq.${me}`)
      .order("active_date", { ascending: false })
      .limit(100);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = rooms ?? [];
    const otherIds = Array.from(new Set(list.map((r) => (r.user1_id === me ? r.user2_id : r.user1_id))));
    let profilesById: Record<string, { display_name: string; avatar_url: string | null }> = {};
    if (otherIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", otherIds);
      profilesById = Object.fromEntries((profs ?? []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]));
    }
    // Fetch last message per room
    const enriched: Row[] = await Promise.all(list.map(async (r) => {
      const otherId = r.user1_id === me ? r.user2_id : r.user1_id;
      const { data: msg } = await supabase
        .from("messages")
        .select("content, created_at")
        .eq("room_id", r.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        id: r.id,
        active_date: r.active_date,
        expires_at: r.expires_at,
        other_id: otherId,
        last_message: msg?.content ?? null,
        last_at: msg?.created_at ?? null,
        other: profilesById[otherId] ?? null,
      };
    }));
    setRows(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="max-w-3xl mx-auto p-6 text-center text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-3">
      <h1 className="text-2xl font-bold tracking-tight mb-4">대화 기록</h1>
      {rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">아직 나눈 대화가 없어요</CardContent></Card>
      ) : rows.map((r) => {
        const expired = new Date(r.expires_at).getTime() <= Date.now();
        return (
          <Link key={r.id} to="/chat/$roomId" params={{ roomId: r.id }} className="block">
            <Card className="hover:bg-accent/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={r.other?.avatar_url ?? undefined} />
                    <AvatarFallback>{r.other?.display_name?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.other?.display_name ?? "사용자"}</span>
                      <Badge variant={expired ? "outline" : "secondary"}>
                        {expired ? "종료됨" : "진행 중"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(r.active_date)}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground truncate">
                      {r.last_message ?? "메시지 없음"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
