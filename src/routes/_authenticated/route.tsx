import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Home, Inbox, User, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { count } = await supabase
        .from("conversation_requests")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", u.user.id)
        .eq("status", "pending");
      if (active) setPendingCount(count ?? 0);
    }
    load();
    const channel = supabase
      .channel("nav-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_requests" }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isChat = pathname.startsWith("/chat/");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!isChat && (
        <header className="border-b sticky top-0 z-10 bg-background/80 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="font-bold text-lg tracking-tight">OneCall</Link>
            <nav className="flex items-center gap-1">
              <Link to="/">
                <Button variant={pathname === "/" ? "secondary" : "ghost"} size="sm">
                  <Home className="h-4 w-4 mr-1.5" />사람들
                </Button>
              </Link>
              <Link to="/inbox">
                <Button variant={pathname === "/inbox" ? "secondary" : "ghost"} size="sm" className="relative">
                  <Inbox className="h-4 w-4 mr-1.5" />받은 신청
                  {pendingCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant={pathname === "/profile" ? "secondary" : "ghost"} size="sm">
                  <User className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </nav>
          </div>
        </header>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
