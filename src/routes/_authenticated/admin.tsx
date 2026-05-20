import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { generateCardBatch, getRevenueStats } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, TrendingUp, Users } from "lucide-react";
import { formatCardCode } from "@/lib/crypto";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const gen = useServerFn(generateCardBatch);
  const stats = useServerFn(getRevenueStats);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin, loading, navigate]);

  const [plan, setPlan] = useState<"subject" | "quarterly" | "yearly">("quarterly");
  const [count, setCount] = useState(10);
  const [price, setPrice] = useState(85000);
  const [subjectId, setSubjectId] = useState<string>("");
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [revenue, setRevenue] = useState<Awaited<ReturnType<typeof getRevenueStats>> | null>(null);

  useEffect(() => {
    supabase.from("subjects").select("id, name").then(({ data }) => setSubjects(data ?? []));
    stats({}).then(setRevenue).catch(() => {});
  }, [stats]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await gen({
        data: {
          count,
          plan_type: plan,
          subject_id: plan === "subject" ? subjectId || null : null,
          price,
        },
      });
      const csv = "code,plan,price\n" + res.codes.map((c) => `${formatCardCode(c)},${plan},${price}`).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cards_${plan}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`تم توليد ${res.codes.length} كود — جاهز للمطبعة`);
      const fresh = await stats({});
      setRevenue(fresh);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="font-display text-3xl font-bold">لوحة المالك</h1>

      <div className="grid md:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="إجمالي المبيعات" value={`${(revenue?.total_gross ?? 0).toLocaleString()} د.ع`} />
        <StatCard icon={TrendingUp} label="حصة المنصة (25%)" value={`${(revenue?.platform_share ?? 0).toLocaleString()} د.ع`} highlight />
        <StatCard icon={Users} label="حصة المدرسين (75%)" value={`${(revenue?.teachers_share ?? 0).toLocaleString()} د.ع`} />
      </div>

      <form onSubmit={handleGenerate} className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="font-display text-xl font-bold">توليد كروت شحن جديدة</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>نوع الباقة</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as typeof plan)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="subject">مادة واحدة</SelectItem>
                <SelectItem value="quarterly">3 أشهر</SelectItem>
                <SelectItem value="yearly">سنوي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {plan === "subject" && (
            <div>
              <Label>المادة</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="اختر مادة" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>عدد الكروت</Label>
            <Input type="number" min={1} max={5000} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1.5" />
          </div>
          <div>
            <Label>السعر (د.ع)</Label>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1.5" />
          </div>
        </div>
        <Button type="submit" disabled={busy} className="gradient-hero text-primary-foreground">
          <Download className="w-4 h-4 ml-1" />
          {busy ? "جاري التوليد..." : "توليد وتنزيل CSV"}
        </Button>
        <p className="text-xs text-muted-foreground">
          الأكواد تُولَّد بشكل مشفّر، تُخزَّن في قاعدة البيانات كـ SHA-256، وتُعرَض الأكواد الخام مرة واحدة فقط في ملف CSV.
        </p>
      </form>

      {revenue && revenue.by_teacher.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-6">
          <h2 className="font-display text-xl font-bold mb-4">حصص المدرسين</h2>
          <div className="space-y-2">
            {revenue.by_teacher.map((t) => (
              <div key={t.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-muted-foreground">{t.gross.toLocaleString()} د.ع × {t.share}%</div>
                <div className="font-bold text-gold">{t.teacherShare.toLocaleString()} د.ع</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 border ${highlight ? "gradient-gold text-gold-foreground border-gold shadow-gold" : "bg-card border-border"}`}>
      <Icon className="w-5 h-5 mb-2 opacity-70" />
      <div className="text-sm opacity-80">{label}</div>
      <div className="font-display text-2xl font-black mt-1">{value}</div>
    </div>
  );
}