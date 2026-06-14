import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "받은 신청 · True Love" }] }),
  component: InboxPage,
});

type RequestRow = {
  id: string;
  sender_id: string;
  message: string | null;
  status: string;
  request_date: string;
  created_at: string;
  sender: { display_name: string; avatar_url: string | null; bio: string | null } | null;
};

function InboxPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<RequestRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("conversation_requests")
      .select("id, sender_id, message, status, request_date, created_at")
      .eq("receiver_id", u.user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = data ?? [];
    const senderIds = Array.from(new Set(rows.map((r) => r.sender_id)));
    let profilesById: Record<string, { display_name: string; avatar_url: string | null; bio: string | null }> = {};
    if (senderIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, bio")
        .in("id", senderIds);
      profilesById = Object.fromEntries((profs ?? []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url, bio: p.bio }]));
    }
    setRequests(rows.map((r) => ({ ...r, sender: profilesById[r.sender_id] ?? null })) as RequestRow[]);
    setLoading(false);
  }, []);


  useEffect(() => {
    load();
    const refreshTimer = window.setInterval(load, 10_000);
    return () => { window.clearInterval(refreshTimer); };
  }, [load]);

  async function accept(id: string) {
    const { data, error } = await supabase.rpc("accept_request", { _request_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("수락했어요!");
    navigate({ to: "/chat/$roomId", params: { roomId: data as string } });
  }

  async function decline(id: string) {
    const { error } = await supabase.rpc("decline_request", { _request_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("거절했어요");
    load();
  }

  async function deleteConversation() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.rpc("delete_received_conversation", { _request_id: deleteTarget.id });
    if (error) {
      toast.error("대화를 삭제하지 못했어요. 다시 시도해주세요.");
      setDeleting(false);
      return;
    }
    setRequests((current) => current.filter((request) => request.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
    toast.success("대화가 삭제되었어요");
  }

  if (loading) return <div className="max-w-3xl mx-auto p-6 text-center text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-3">
      <h1 className="text-2xl font-bold tracking-tight mb-4">받은 대화 신청</h1>
      {requests.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">아직 받은 신청이 없어요</CardContent></Card>
      ) : requests.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={r.sender?.avatar_url ?? undefined} />
                <AvatarFallback>{r.sender?.display_name?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{r.sender?.display_name ?? "사용자"}</span>
                  <Badge variant={r.status === "pending" ? "default" : r.status === "accepted" ? "secondary" : "outline"}>
                    {r.status === "pending" ? "대기 중" : r.status === "accepted" ? "수락됨" : "거절됨"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{r.request_date}</span>
                </div>
                {r.message && <p className="mt-1.5 text-sm text-foreground/80">{r.message}</p>}
                {r.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => accept(r.id)}>수락</Button>
                    <Button size="sm" variant="outline" onClick={() => decline(r.id)}>거절</Button>
                  </div>
                )}
                {r.status === "accepted" && (
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => setDeleteTarget(r)}>
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      대화 삭제
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>대화를 정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.sender?.display_name ?? "상대방"}님과 나눈 모든 메시지가 영구적으로 삭제되며 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void deleteConversation();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
