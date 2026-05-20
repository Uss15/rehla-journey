// شحن كود الكارت — يعمل على الخادم بصلاحيات service-role لمنع تسريب الأكواد.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sha256 } from "@/lib/crypto";

const REDEEM_INPUT = z.object({
  code: z.string().regex(/^\d{12}$/, "يجب أن يتكون الكود من 12 رقماً"),
});

const MAX_FAILS = 5;
const LOCK_HOURS = 6;
const WINDOW_MINUTES = 60;

// مدة الاشتراك بالأيام
function expiryFor(plan: "subject" | "quarterly" | "yearly"): Date {
  const now = new Date();
  if (plan === "quarterly") {
    now.setDate(now.getDate() + 90);
  } else if (plan === "yearly" || plan === "subject") {
    // ثابت حتى نهاية السنة الدراسية: 30 حزيران من السنة القادمة (إن كنا بعد حزيران)
    const y = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    return new Date(y, 5, 30, 23, 59, 59);
  }
  return now;
}

export const redeemCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => REDEEM_INPUT.parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const code = data.code.trim();

    // فحص القفل
    const { data: lock } = await supabaseAdmin
      .from("redemption_locks")
      .select("locked_until")
      .eq("user_id", userId)
      .maybeSingle();
    if (lock && new Date(lock.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(lock.locked_until).getTime() - Date.now()) / 60000);
      return { ok: false as const, error: `الحساب مقفل بسبب محاولات خاطئة. أعد المحاولة بعد ${mins} دقيقة.` };
    }

    const codeHash = await sha256(code);

    // محاولة الاسترداد الذرّي: نختار الكارت غير المستخدم ونحدّثه فقط إذا كان used_by IS NULL.
    const { data: card } = await supabaseAdmin
      .from("cards")
      .select("*")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (!card || card.used_by) {
      await logFail(userId);
      return { ok: false as const, error: "كود غير صحيح أو مستخدم سابقاً." };
    }

    // تحديث ذري: used_by ما زال null
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("cards")
      .update({ used_by: userId, used_at: new Date().toISOString() })
      .eq("id", card.id)
      .is("used_by", null)
      .select()
      .maybeSingle();

    if (claimErr || !claimed) {
      await logFail(userId);
      return { ok: false as const, error: "تعذّر تفعيل الكود." };
    }

    const expires = expiryFor(card.plan_type);

    const { error: subErr } = await supabaseAdmin.from("subscriptions").insert({
      user_id: userId,
      plan_type: card.plan_type,
      subject_id: card.subject_id,
      card_id: card.id,
      expires_at: expires.toISOString(),
    });
    if (subErr) {
      return { ok: false as const, error: "حدث خطأ أثناء إنشاء الاشتراك." };
    }

    await supabaseAdmin.from("redemption_attempts").insert({
      user_id: userId,
      success: true,
    });

    return {
      ok: true as const,
      plan: card.plan_type,
      expires_at: expires.toISOString(),
    };

    async function logFail(uid: string) {
      await supabaseAdmin.from("redemption_attempts").insert({ user_id: uid, success: false });
      const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
      const { count } = await supabaseAdmin
        .from("redemption_attempts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("success", false)
        .gte("attempted_at", since);
      if ((count ?? 0) >= MAX_FAILS) {
        const until = new Date(Date.now() + LOCK_HOURS * 3600_000).toISOString();
        await supabaseAdmin
          .from("redemption_locks")
          .upsert({ user_id: uid, locked_until: until }, { onConflict: "user_id" });
      }
    }
  });

// التحقق من صلاحية الوصول لدرس معين بناءً على اشتراكات الطالب.
export const checkLessonAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lessonId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: lesson } = await supabaseAdmin
      .from("lessons")
      .select("id, is_free_preview, chapter_id, chapters(subject_id)")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson) return { allowed: false as const, reason: "not_found" };
    if (lesson.is_free_preview) return { allowed: true as const, reason: "free" };

    const subjectId = (lesson.chapters as { subject_id: string } | null)?.subject_id;

    const nowIso = new Date().toISOString();
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_type, subject_id, expires_at")
      .eq("user_id", context.userId)
      .gt("expires_at", nowIso);

    const ok = (subs ?? []).some(
      (s) =>
        s.plan_type === "yearly" ||
        s.plan_type === "quarterly" ||
        (s.plan_type === "subject" && s.subject_id === subjectId),
    );
    return ok ? { allowed: true as const, reason: "subscribed" } : { allowed: false as const, reason: "no_subscription" };
  });