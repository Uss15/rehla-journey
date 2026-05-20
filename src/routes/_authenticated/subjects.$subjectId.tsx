import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, PlayCircle, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/subjects/$subjectId")({
  component: SubjectPage,
});

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: async () => {
      const { data: subject } = await supabase.from("subjects").select("*, teachers(name)").eq("id", subjectId).maybeSingle();
      const { data: chapters } = await supabase
        .from("chapters")
        .select("*, lessons(id, title, duration_seconds, order_index)")
        .eq("subject_id", subjectId)
        .order("order_index");
      return { subject, chapters: chapters ?? [] };
    },
  });

  if (!data?.subject) return <div className="text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4 ml-1" />الرجوع للمواد
      </Link>
      <div className="rounded-3xl gradient-hero text-primary-foreground p-8 shadow-glow">
        <div className="text-sm opacity-80 mb-1">{(data.subject.teachers as { name: string } | null)?.name}</div>
        <h1 className="font-display text-3xl font-bold">{data.subject.name}</h1>
        {data.subject.description && <p className="mt-2 opacity-90">{data.subject.description}</p>}
      </div>
      <div className="space-y-4">
        {data.chapters.map((ch, i) => (
          <div key={ch.id} className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 font-display font-bold">
              الفصل {i + 1}: {ch.title}
            </div>
            <div className="divide-y divide-border">
              {((ch.lessons as Array<{ id: string; title: string; duration_seconds: number | null }>) ?? []).map((l) => (
                <Link
                  key={l.id}
                  to="/lessons/$lessonId"
                  params={{ lessonId: l.id }}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-accent transition-colors"
                >
                  <PlayCircle className="w-5 h-5 text-gold" />
                  <span className="flex-1">{l.title}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="w-3 h-3" />PDF
                  </span>
                </Link>
              ))}
              {(!ch.lessons || (ch.lessons as unknown[]).length === 0) && (
                <div className="px-5 py-4 text-sm text-muted-foreground">لا توجد دروس بعد.</div>
              )}
            </div>
          </div>
        ))}
        {data.chapters.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            لا توجد فصول بعد.
          </div>
        )}
      </div>
    </div>
  );
}