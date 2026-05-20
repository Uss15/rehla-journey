import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { redeemCard } from "@/lib/redemption.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CreditCard, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/recharge")({
  component: Recharge,
});

function Recharge() {
  const redeem = useServerFn(redeemCard);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 12) { toast.error("يجب أن يتكون الكود من 12 رقماً"); return; }
    setBusy(true);
    try {
      const res = await redeem({ data: { code: clean } });
      if (res.ok) {
        toast.success(`تم التفعيل! صالح حتى ${new Date(res.expires_at).toLocaleDateString("ar-IQ")}`);
        setCode("");
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-3xl gradient-hero text-primary-foreground p-10 shadow-glow text-center">
        <div className="w-16 h-16 rounded-2xl gradient-gold mx-auto flex items-center justify-center shadow-gold mb-4">
          <Sparkles className="w-7 h-7 text-gold-foreground" />
        </div>
        <h1 className="font-display text-3xl font-bold mb-2">اشحن رِحلتك</h1>
        <p className="text-primary-foreground/80">أدخل كود الكارت (12 رقماً) لتفعيل اشتراكك.</p>
      </div>

      <form onSubmit={submit} className="rounded-3xl bg-card border border-border p-8 mt-6 space-y-5">
        <div>
          <label className="text-sm font-medium mb-2 block flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> كود الكارت
          </label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="0000 0000 0000"
            dir="ltr"
            className="text-center text-2xl tracking-[0.4em] h-16 font-mono"
            maxLength={16}
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full gradient-gold text-gold-foreground h-12 text-base">
          {busy ? "..." : "تفعيل الكود"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          ⚠️ 5 محاولات خاطئة تُغلق الحساب لمدة 6 ساعات.
        </p>
      </form>
    </div>
  );
}