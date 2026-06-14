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
      // 온보딩 체크: 미완료면 온보딩 페이지로 이동
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", u.user.id)
        .single();
      if (active && profile && !profile.onboarded && pathname !== "/onboarding") {
        navigate({ to: "/onboarding", replace: true });
        return;
      }
      const { count } = await supabase
        .from("conversation_requests")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", u.user.id)
        .eq("status", "pending");
      if (active) setPendingCount(count ?? 0);
    }
    load();
    const refreshTimer = window.setInterval(load, 15_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [pathname, navigate]);


  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isChat = pathname.startsWith("/chat/");
  const isOnboarding = pathname === "/onboarding";
  const hideNav = isChat || isOnboarding;


  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!hideNav && (
        <header className="border-b sticky top-0 z-10 bg-background/80 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="font-bold text-lg tracking-tight">True Love</Link>
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
