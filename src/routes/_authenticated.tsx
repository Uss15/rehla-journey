import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut, CreditCard, LayoutDashboard, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-gold flex items-center justify-center shadow-gold">
              <Sparkles className="w-4 h-4 text-gold-foreground" />
            </div>
            <span className="font-display text-xl font-bold">رِحلة</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><LayoutDashboard className="w-4 h-4 ml-1" />دروسي</Button></Link>
            <Link to="/recharge"><Button variant="ghost" size="sm"><CreditCard className="w-4 h-4 ml-1" />شحن كود</Button></Link>
            {isAdmin && (
              <Link to="/admin"><Button variant="ghost" size="sm"><Shield className="w-4 h-4 ml-1" />الإدارة</Button></Link>
            )}
            <div className="hidden md:block text-sm text-muted-foreground border-r border-border pr-3 mr-2">{profile?.full_name}</div>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8"><Outlet /></main>
    </div>
  );
}