import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { checkLessonAccess } from "@/lib/redemption.functions";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Lock, FileText, ChevronLeft, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lessons/$lessonId")({
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const { user, profile } = useAuth();
  const access = useServerFn(checkLessonAccess);

  const { data: lesson } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lessons")
        .select("*, chapters(title, subject_id, subjects(name))")
        .eq("id", lessonId)
        .maybeSingle();
      return data;
    },
  });

  const { data: accessRes } = useQuery({
    queryKey: ["access", lessonId, user?.id],
    queryFn: () => access({ data: { lessonId } }),
    enabled: !!user,
  });

  const { data: quiz } = useQuery({
    queryKey: ["quiz", lessonId],
    queryFn: async () => {
      const { data } = await supabase.from("quiz_questions").select("*").eq("lesson_id", lessonId).order("order_index");
      return data ?? [];
    },
  });

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!lesson) return <div className="text-muted-foreground">جاري التحميل...</div>;

  const allowed = accessRes?.allowed;
  const chapter = lesson.chapters as { title: string; subject_id: string; subjects: { name: string } | null } | null;

  async function submitQuiz() {
    if (!quiz || !user) return;
    const total = quiz.length;
    const score = quiz.reduce((acc, q) => acc + (answers[q.id] === q.correct_index ? 1 : 0), 0);
    await supabase.from("quiz_attempts").insert({ user_id: user.id, lesson_id: lessonId, score, total });
    setSubmitted(true);
    toast.success(`نتيجتك: ${score}/${total}`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/subjects/$subjectId" params={{ subjectId: chapter?.subject_id ?? "" }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4 ml-1" />{chapter?.subjects?.name ?? "الرجوع"}
      </Link>
      <div>
        <div className="text-sm text-muted-foreground">{chapter?.title}</div>
        <h1 className="font-display text-3xl font-bold">{lesson.title}</h1>
      </div>

      {allowed && lesson.video_hls_url ? (
        <VideoPlayer
          src={lesson.video_hls_url}
          watermarkName={profile?.full_name ?? "طالب"}
          watermarkPhone={profile?.phone ?? ""}
        />
      ) : (
        <div className="aspect-video rounded-2xl bg-card border border-border flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Lock className="w-10 h-10 text-gold" />
          <div className="font-display font-bold">هذا الدرس مقفل</div>
          <Link to="/recharge"><Button className="gradient-gold text-gold-foreground">اشحن رِحلتك</Button></Link>
        </div>
      )}

      {lesson.pdf_url && allowed && (
        <a href={lesson.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-accent text-accent-foreground px-4 py-2.5 hover:opacity-90">
          <FileText className="w-4 h-4" /> ملخص الدرس (PDF)
        </a>
      )}

      {allowed && quiz && quiz.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-6">
          <h2 className="font-display text-xl font-bold mb-4">اختبار سريع</h2>
          <div className="space-y-5">
            {quiz.map((q, qi) => {
              const opts = q.options as string[];
              return (
                <div key={q.id}>
                  <div className="font-medium mb-2">{qi + 1}. {q.question}</div>
                  <div className="space-y-1.5">
                    {opts.map((opt, oi) => {
                      const chosen = answers[q.id] === oi;
                      const correct = submitted && oi === q.correct_index;
                      const wrong = submitted && chosen && oi !== q.correct_index;
                      return (
                        <button
                          key={oi}
                          disabled={submitted}
                          onClick={() => setAnswers({ ...answers, [q.id]: oi })}
                          className={`w-full text-right px-4 py-2.5 rounded-lg border transition-colors flex items-center justify-between ${
                            correct ? "bg-green-500/10 border-green-500/40" :
                            wrong ? "bg-destructive/10 border-destructive/40" :
                            chosen ? "bg-accent border-gold" : "border-border hover:bg-accent"
                          }`}
                        >
                          <span>{opt}</span>
                          {correct && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                          {wrong && <XCircle className="w-4 h-4 text-destructive" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {!submitted && (
            <Button onClick={submitQuiz} disabled={Object.keys(answers).length !== quiz.length} className="mt-5 gradient-hero text-primary-foreground">
              تسليم الاختبار
            </Button>
          )}
        </div>
      )}
    </div>
  );
}