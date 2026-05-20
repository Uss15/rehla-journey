// دوال لوحة المالك — توليد الأكواد، إحصائيات الأرباح.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateCardCode, sha256 } from "@/lib/crypto";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("صلاحيات غير كافية.");
}

const GEN_INPUT = z.object({
  count: z.number().int().min(1).max(5000),
  plan_type: z.enum(["subject", "quarterly", "yearly"]),
  subject_id: z.string().uuid().nullable().optional(),
  price: z.number().min(0),
  note: z.string().max(200).optional(),
});

export const generateCardBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GEN_INPUT.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: batch, error: bErr } = await supabaseAdmin
      .from("card_batches")
      .insert({
        created_by: context.userId,
        plan_type: data.plan_type,
        subject_id: data.subject_id ?? null,
        count: data.count,
        price: data.price,
        note: data.note,
      })
      .select()
      .single();
    if (bErr || !batch) throw new Error("تعذّر إنشاء الحزمة.");

    const codes: string[] = [];
    const rows: Array<{
      batch_id: string;
      code_hash: string;
      code_last4: string;
      plan_type: typeof data.plan_type;
      subject_id: string | null;
      price: number;
    }> = [];
    const seen = new Set<string>();
    while (codes.length < data.count) {
      const c = generateCardCode();
      if (seen.has(c)) continue;
      seen.add(c);
      const h = await sha256(c);
      codes.push(c);
      rows.push({
        batch_id: batch.id,
        code_hash: h,
        code_last4: c.slice(-4),
        plan_type: data.plan_type,
        subject_id: data.subject_id ?? null,
        price: data.price,
      });
    }

    // إدخال على دفعات لتجنّب حدود الحجم
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabaseAdmin.from("cards").insert(rows.slice(i, i + CHUNK));
      if (error) throw new Error("فشل إدخال الأكواد: " + error.message);
    }

    // نُعيد الأكواد الخام مرة واحدة فقط (للتصدير) ولا تُخزَّن.
    return { batch_id: batch.id, codes };
  });

export const getRevenueStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: used } = await supabaseAdmin
      .from("cards")
      .select("price, plan_type, subject_id, used_at, subjects(teacher_id, teachers(name, share_percentage))")
      .not("used_at", "is", null);

    let totalGross = 0;
    const byTeacher: Record<string, { name: string; gross: number; share: number; teacherShare: number; platformShare: number }> = {};
    for (const c of used ?? []) {
      const price = Number(c.price);
      totalGross += price;
      const subj = c.subjects as { teachers: { name: string; share_percentage: number } | null } | null;
      const teacher = subj?.teachers;
      if (teacher) {
        const key = teacher.name;
        if (!byTeacher[key]) {
          byTeacher[key] = {
            name: teacher.name,
            gross: 0,
            share: Number(teacher.share_percentage),
            teacherShare: 0,
            platformShare: 0,
          };
        }
        byTeacher[key].gross += price;
      }
    }
    for (const k in byTeacher) {
      const t = byTeacher[k];
      t.teacherShare = (t.gross * t.share) / 100;
      t.platformShare = t.gross - t.teacherShare;
    }
    const platformDefault = totalGross * 0.25;
    return {
      total_gross: totalGross,
      platform_share: platformDefault,
      teachers_share: totalGross - platformDefault,
      cards_used: used?.length ?? 0,
      by_teacher: Object.values(byTeacher),
    };
  });