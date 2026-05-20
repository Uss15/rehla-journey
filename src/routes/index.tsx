import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ShieldCheck, Sparkles, Zap, GraduationCap, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "رِحلة — تعلّم بأسلوب جديد" },
      { name: "description", content: "دروس قصيرة، ملخصات PDF، اختبارات تثبيت. اشحن رِحلتك بكود واحد وانطلق." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="container mx-auto flex items-center justify-between py-6 px-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center shadow-gold">
            <Sparkles className="w-5 h-5 text-gold-foreground" />
          </div>
          <span className="font-display text-2xl font-bold">رِحلة</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login"><Button variant="ghost">تسجيل الدخول</Button></Link>
          <Link to="/login"><Button className="gradient-gold text-gold-foreground hover:opacity-90">ابدأ رِحلتك</Button></Link>
        </div>
      </header>

      <section className="container mx-auto px-4 pt-14 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm text-accent-foreground mb-6">
          <Zap className="w-4 h-4 text-gold" />
          منصة مُحسَّنة لشبكات 3G/4G في العراق
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-black leading-tight tracking-tight">
          تعلّم بثقة.
          <br />
          <span className="bg-clip-text text-transparent gradient-gold">اشحن رِحلتك بكود واحد.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          دروس مصوّرة قصيرة (5–12 دقيقة)، ملخصات PDF مدمجة، واختبار سريع بعد كل درس.
          نظام محكم لحماية المحتوى وحقوق المدرسين.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/login">
            <Button size="lg" className="gradient-hero text-primary-foreground shadow-glow hover:opacity-95 px-8 h-12 text-base">
              <GraduationCap className="ml-2 w-5 h-5" />
              ابدأ التعلم الآن
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" className="px-8 h-12 text-base">
              <CreditCard className="ml-2 w-5 h-5" />
              عندي كود شحن
            </Button>
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: BookOpen, title: "كروت تفاعلية", desc: "كل درس كارت مستقل: فيديو قصير + PDF + اختبار 3 أسئلة." },
          { icon: ShieldCheck, title: "حماية المحتوى", desc: "علامة مائية ديناميكية، تشفير HLS، وجلسة واحدة لكل طالب." },
          { icon: Sparkles, title: "اشحن بسهولة", desc: "كود من 12 رقم — كارت مادة، 3 أشهر، أو اشتراك سنوي." },
        ].map((f) => (
          <div key={f.title} className="rounded-3xl bg-card border border-border p-7 hover:shadow-glow transition-shadow">
            <div className="w-12 h-12 rounded-2xl gradient-hero flex items-center justify-center mb-5">
              <f.icon className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="font-display text-xl font-bold mb-2">{f.title}</h3>
            <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="container mx-auto px-4 pb-24">
        <div className="rounded-3xl gradient-hero text-primary-foreground p-10 md:p-14 text-center shadow-glow">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">باقات تناسب كل طالب</h2>
          <p className="text-primary-foreground/80 mb-8">اختر الباقة الأنسب لك وفعّلها بكود واحد.</p>
          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { name: "مادة واحدة", price: "35,000", note: "د.ع — حتى نهاية السنة" },
              { name: "3 أشهر — كل المواد", price: "85,000", note: "د.ع — لجميع المدرسين" },
              { name: "سنوي — كل المواد", price: "150,000", note: "د.ع — حتى نهاية الوزارية", featured: true },
            ].map((p) => (
              <div key={p.name} className={`rounded-2xl p-6 border ${p.featured ? "bg-gold text-gold-foreground border-gold shadow-gold scale-105" : "bg-primary-foreground/10 border-primary-foreground/20"}`}>
                <div className="text-sm opacity-80 mb-1">{p.name}</div>
                <div className="font-display text-3xl font-black">{p.price}</div>
                <div className="text-xs opacity-70 mt-1">{p.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} رِحلة — جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}
