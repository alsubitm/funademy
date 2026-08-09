import { useState } from "react";
import { Button } from "@workspace/funademy-ds/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/funademy-ds/components/ui/card";
import { Badge } from "@workspace/funademy-ds/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
} from "@workspace/funademy-ds/components/ui/avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/funademy-ds/components/ui/accordion";
import { Separator } from "@workspace/funademy-ds/components/ui/separator";
import {
  Menu,
  X,
  Phone,
  MapPin,
  Mail,
  MessageCircle,
  Star,
  ShieldCheck,
  Award,
  Users,
  Rocket,
  Cpu,
  Blocks,
  Code2,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Blueprint grid background helper                                    */
/* ------------------------------------------------------------------ */
function BlueprintGrid({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(91,138,245,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(91,138,245,0.12) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    />
  );
}

const NAV = [
  { label: "البرامج", href: "#programs" },
  { label: "لماذا فن أكاديمي", href: "#why" },
  { label: "آراء الأهالي", href: "#testimonials" },
  { label: "الأسئلة الشائعة", href: "#faq" },
  { label: "تواصل معنا", href: "#contact" },
];

const PROGRAMS = [
  {
    icon: Blocks,
    age: "٤ – ٦ سنوات",
    title: "روبوتيكس مبكّر",
    desc: "لبنات LEGO® DUPLO® كبيرة وقصص تفاعلية تُنمّي المهارات الحركية والتفكير المنطقي في بيئة آمنة وممتعة.",
    img: "/__mockup/images/prog-early.jpg",
    points: ["مجموعات صغيرة ٦ أطفال", "حصة ٤٥ دقيقة", "دعم حسّي وحركي"],
    tone: "chart3",
  },
  {
    icon: Cpu,
    age: "٧ – ١٢ سنة",
    title: "هندسة ليغو وروبوتات",
    desc: "ميكانيكا حقيقية وتروس ومحركات ومجسّات — يبني الطفل نماذج تعمل فعلاً ويكتشف مبادئ الفيزياء والهندسة.",
    img: "/__mockup/images/prog-lego.jpg",
    points: ["مناهج e² Young Engineers", "مشاريع أسبوعية", "شهادة إتمام معتمدة"],
    tone: "primary",
  },
  {
    icon: Code2,
    age: "١٣ – ١٨ سنة",
    title: "برمجة وروبوتات متقدمة",
    desc: "برمجة الروبوتات، لوحات التحكّم والمستشعرات وأساسيات الذكاء الاصطناعي — إعداد حقيقي لمهندسي المستقبل.",
    img: "/__mockup/images/prog-code.jpg",
    points: ["برمجة بلوكات ونصية", "تحديات هندسية", "مسار تنافسي"],
    tone: "chart4",
  },
];

const STATS = [
  { icon: Users, value: "٢٥٠٠+", label: "طالب وطالبة" },
  { icon: Award, value: "١٢+", label: "سنة خبرة عالمية" },
  { icon: MapPin, value: "٣", label: "فروع في الرياض" },
  { icon: Star, value: "٤٫٩", label: "تقييم الأهالي" },
];

const WHY = [
  {
    icon: ShieldCheck,
    title: "اعتماد e² Young Engineers العالمي",
    desc: "مناهج مرخّصة عالمياً ومطبّقة في أكثر من ٤٥ دولة، مُعرّبة بالكامل ومُهيّأة للبيئة السعودية.",
  },
  {
    icon: Rocket,
    title: "التعلّم بالتجربة لا بالتلقين",
    desc: "كل حصة مشروع يُبنى باليد — يفكّر الطفل ويجرّب ويحلّ المشكلات كمهندس صغير.",
  },
  {
    icon: Users,
    title: "مجموعات صغيرة ومدرّبون معتمدون",
    desc: "عدد محدود لكل مجموعة يضمن اهتماماً فردياً، بإشراف مدرّبين معتمدين من الأكاديمية.",
  },
  {
    icon: CheckCircle2,
    title: "تقارير تقدّم دورية للأهالي",
    desc: "متابعة واضحة لمستوى طفلك ومهاراته المكتسبة بعد كل وحدة تعليمية.",
  },
];

const TESTIMONIALS = [
  {
    name: "أم عبدالله",
    role: "ولية أمر — حي النرجس",
    text: "ابني صار يفكّ ويركّب ويشرح لي كيف تشتغل التروس! الحصص منظّمة والمدرّبة صبورة ومحترفة. أفضل قرار سجّلته له.",
  },
  {
    name: "خالد الحربي",
    role: "ولي أمر — حي الملقا",
    text: "الفرق واضح بعد فصل واحد. صار عنده ثقة وحبّ للعلوم، والتقارير الأسبوعية تطمّنني على مستواه أولاً بأول.",
  },
  {
    name: "نورة القحطاني",
    role: "ولية أمر — حي حطين",
    text: "الاعتماد العالمي طمأنني من البداية، والبيئة آمنة ونظيفة. بنتي تعدّ الأيام للحصة القادمة!",
  },
];

const FAQS = [
  {
    q: "ما هي الحصة التجريبية المجانية؟",
    a: "حصة كاملة يجرّب فيها طفلك أحد المشاريع الهندسية مع مدرّب معتمد، لتقرروا معاً المسار الأنسب — دون أي التزام.",
  },
  {
    q: "كيف تختارون البرنامج المناسب لعمر طفلي؟",
    a: "نُقيّم عمر الطفل ومهاراته السابقة في الحصة التجريبية، ثم نرشّحه للمسار الملائم من مساراتنا الثلاثة (٤–٦، ٧–١٢، ١٣–١٨).",
  },
  {
    q: "هل الحصص حضورية أم عن بُعد؟",
    a: "نوفّر حصصاً حضورية في فروعنا الثلاثة بالرياض، مع خيار حصص مباشرة أونلاين لبعض المسارات حسب رغبة الأسرة.",
  },
  {
    q: "هل يحصل الطفل على شهادة؟",
    a: "نعم، يحصل الطفل على شهادة إتمام معتمدة من e² Young Engineers عند إنهاء كل مستوى تعليمي.",
  },
];

export default function HomeClassic() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-background font-sans text-foreground">
      {/* ============================ Header ============================ */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <a href="#top" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="font-serif text-xl font-bold leading-none">
              فن أكاديمي
            </span>
          </a>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="sm" asChild>
              <a href="#contact">تسجيل الدخول</a>
            </Button>
            <Button size="sm" asChild>
              <a href="#trial">احجز حصة تجريبية</a>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="القائمة"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {menuOpen && (
          <div className="border-t border-border bg-background md:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {n.label}
                </a>
              ))}
              <Button className="mt-2" asChild>
                <a href="#trial" onClick={() => setMenuOpen(false)}>
                  احجز حصة تجريبية
                </a>
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* ============================ Hero ============================ */}
      <section id="top" className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <BlueprintGrid />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <Badge
              variant="outline"
              className="border-accent/40 bg-accent/10 text-accent"
            >
              <ShieldCheck className="ml-1 h-3.5 w-3.5" />
              اعتماد e² Young Engineers العالمي
            </Badge>

            <h1 className="font-serif text-4xl font-bold leading-tight md:text-5xl">
              لا نُعلّم أطفالنا عن الهندسة —
              <br />
              <span className="text-accent">بل نصنع منهم مهندسين.</span>
            </h1>

            <p className="max-w-xl text-lg text-sidebar-foreground/80">
              أكاديمية هندسة للأطفال في الرياض — برامج LEGO® وروبوتات وبرمجة
              للأعمار ٤–١٨، بمناهج عالمية معتمدة ومدرّبين محترفين.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <a href="#trial">
                  احجز حصة تجريبية مجانية
                  <ArrowLeft className="h-4 w-4" />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-sidebar-border bg-transparent text-sidebar-foreground"
                asChild
              >
                <a href="#programs">استكشف البرامج</a>
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-sidebar-foreground/70">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-accent" /> ١٢+ سنة خبرة عالمية
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-accent" /> مدرّبون معتمدون
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-accent" /> الأعمار ٤–١٨
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-lg border border-sidebar-border shadow-xl">
              <img
                src="/__mockup/images/hero-kids.jpg"
                alt="طفل يبني نموذج روبوت من مكعبات LEGO"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            <Card className="absolute -bottom-5 right-4 w-44 border-border/60 shadow-lg">
              <CardContent className="flex items-center gap-3 p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Rocket className="h-5 w-5" />
                </span>
                <div className="leading-tight">
                  <div className="font-serif text-lg font-bold text-foreground">١٠٠٪</div>
                  <div className="text-xs text-muted-foreground">متعة التعلّم</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ============================ Stats ============================ */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <s.icon className="h-5 w-5" />
              </span>
              <div className="font-serif text-3xl font-bold text-foreground">
                {s.value}
              </div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ Programs ============================ */}
      <section id="programs" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3">
            مساراتنا التعليمية
          </Badge>
          <h2 className="font-serif text-3xl font-bold md:text-4xl">
            برامج مصمّمة لكل مرحلة عمرية
          </h2>
          <p className="mt-3 text-muted-foreground">
            ثلاثة مسارات متدرّجة تنمو مع طفلك من اللبنات الأولى حتى برمجة الروبوتات.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PROGRAMS.map((p) => (
            <Card
              key={p.title}
              className="flex flex-col overflow-hidden border-border transition-shadow hover:shadow-lg"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={p.img}
                  alt={p.title}
                  className="h-full w-full object-cover"
                />
                <Badge className="absolute right-3 top-3 bg-accent text-accent-foreground">
                  {p.age}
                </Badge>
              </div>
              <CardHeader className="gap-2">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-md text-primary-foreground"
                  style={{ background: `hsl(var(--${p.tone}))` }}
                >
                  <p.icon className="h-5 w-5" />
                </span>
                <CardTitle className="font-serif text-xl">{p.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-sm text-muted-foreground">{p.desc}</p>
                <ul className="space-y-2 text-sm">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="mt-auto w-full" asChild>
                  <a href="#trial">
                    سجّل في هذا المسار
                    <ArrowLeft className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ============================ Why us / Trust ============================ */}
      <section id="why" className="relative overflow-hidden bg-secondary/40">
        <BlueprintGrid className="opacity-60" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Badge variant="secondary" className="mb-3">
              لماذا فن أكاديمي
            </Badge>
            <h2 className="font-serif text-3xl font-bold md:text-4xl">
              ثقة الأهالي مبنية على أساس متين
            </h2>
            <p className="mt-3 text-muted-foreground">
              منهجية عالمية معتمدة، بيئة آمنة، ومتابعة دقيقة لتطوّر طفلك.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((w) => (
              <Card key={w.title} className="border-border bg-card">
                <CardContent className="space-y-3 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <w.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-serif text-lg font-bold">{w.title}</h3>
                  <p className="text-sm text-muted-foreground">{w.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ Testimonials ============================ */}
      <section id="testimonials" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3">
            آراء الأهالي
          </Badge>
          <h2 className="font-serif text-3xl font-bold md:text-4xl">
            ماذا يقول أولياء الأمور؟
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="flex flex-col border-border">
              <CardContent className="flex flex-1 flex-col gap-4 p-6">
                <div className="flex gap-0.5 text-accent">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-foreground/90">
                  "{t.text}"
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <Avatar>
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      {t.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ============================ CTA / Trial ============================ */}
      <section id="trial" className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <BlueprintGrid />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center md:py-20">
          <Badge variant="outline" className="mb-4 border-accent/40 bg-accent/10 text-accent">
            <Sparkles className="ml-1 h-3.5 w-3.5" />
            الحصة الأولى مجانية دائماً
          </Badge>
          <h2 className="font-serif text-3xl font-bold md:text-4xl">
            ابدأ رحلة طفلك الهندسية اليوم
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sidebar-foreground/80">
            احجز حصة تجريبية مجانية وشاهد شغف طفلك يتحوّل إلى مهارة حقيقية بإشراف
            مدرّبينا المعتمدين.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <a href="#contact">
                احجز حصة تجريبية مجانية
                <ArrowLeft className="h-4 w-4" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-sidebar-border bg-transparent text-sidebar-foreground"
              asChild
            >
              <a href="https://wa.me/966500000000" target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                تواصل عبر واتساب
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ============================ FAQ ============================ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-16 md:py-24">
        <div className="mb-10 text-center">
          <Badge variant="secondary" className="mb-3">
            الأسئلة الشائعة
          </Badge>
          <h2 className="font-serif text-3xl font-bold md:text-4xl">
            كل ما يهمّك كولي أمر
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-right font-serif text-base font-semibold">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ============================ Footer ============================ */}
      <footer id="contact" className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="font-serif text-xl font-bold">فن أكاديمي</span>
            </div>
            <p className="text-sm text-muted-foreground">
              أكاديمية هندسة للأطفال في الرياض — نصنع مهندسي المستقبل بمناهج عالمية
              معتمدة.
            </p>
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              معتمد e² Young Engineers
            </Badge>
          </div>

          <div>
            <h4 className="mb-3 font-serif text-sm font-bold">روابط سريعة</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="hover:text-foreground">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 font-serif text-sm font-bold">البرامج</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {PROGRAMS.map((p) => (
                <li key={p.title}>
                  <a href="#programs" className="hover:text-foreground">
                    {p.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 font-serif text-sm font-bold">تواصل معنا</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                الرياض — النرجس، الملقا، حطين
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <span dir="ltr">+966 50 000 0000</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                hello@funademy.io
              </li>
            </ul>
            <Button className="mt-4 w-full" asChild>
              <a href="https://wa.me/966500000000" target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                راسلنا على واتساب
              </a>
            </Button>
          </div>
        </div>
        <Separator />
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
          <span>© ٢٠٢٥ فن أكاديمي. جميع الحقوق محفوظة.</span>
          <span>funademy.io</span>
        </div>
      </footer>
    </div>
  );
}
