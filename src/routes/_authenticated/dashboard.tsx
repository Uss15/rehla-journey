import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BookOpen, Lock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useAuth();

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subjects")
        .select("id, name, description, cover_image_url, price, grade_level, teachers(name)")
        .eq("is_published", true);
      return data ?? [];
    },
  });

  const { data: subs } = useQuery({
    queryKey: ["my-subs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan_type, subject_id, expires_at")
        .eq("user_id", user!.id)
        .gt("expires_at", new Date().toISOString());
      return data ?? [];
    },
    enabled: !!user,
  });

  const hasFullAccess = (subs ?? []).some((s) => s.plan_type === "quarterly" || s.plan_type === "yearly");
  const subjectAccess = new Set((subs ?? []).filter((s) => s.plan_type === "subject").map((s) => s.subject_id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">أهلاً، {profile?.full_name?.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground mt-1">اختر مادة لبدء رحلتك التعليمية.</p>
      </div>

      {(!subjects || subjects.length === 0) && (
        <div className="rounded-2xl bg-card border border-dashed border-border p-10 text-center text-muted-foreground">
          لا توجد مواد متاحة حالياً. ستظهر هنا فور إضافتها من قِبل الإدارة.
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {subjects?.map((s) => {
          const access = hasFullAccess || subjectAccess.has(s.id);
          return (
            <Link
              key={s.id}
              to="/subjects/$subjectId"
              params={{ subjectId: s.id }}
              className="group rounded-2xl bg-card border border-border overflow-hidden hover:shadow-glow transition-all"
            >
              <div className="aspect-video gradient-hero relative">
                {s.cover_image_url && (
                  <img src={s.cover_image_url} alt={s.name} className="w-full h-full object-cover opacity-80" />
                )}
                <div className="absolute top-3 left-3">
                  {access ? (
                    <span className="bg-gold text-gold-foreground text-xs px-3 py-1 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />مفعّل</span>
                  ) : (
                    <span className="bg-black/40 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1"><Lock className="w-3 h-3" />مقفل</span>
                  )}
                </div>
              </div>
              <div className="p-5">
                <div className="text-xs text-muted-foreground mb-1">{(s.teachers as { name: string } | null)?.name ?? "—"}</div>
                <h3 className="font-display text-lg font-bold mb-1">{s.name}</h3>
                {s.description && <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground"><BookOpen className="w-4 h-4" />{s.grade_level ?? "عام"}</div>
                  <div className="text-sm font-bold">{Number(s.price).toLocaleString()} د.ع</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}