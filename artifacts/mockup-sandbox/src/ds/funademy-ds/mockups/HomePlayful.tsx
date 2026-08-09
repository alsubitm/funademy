import {
  Sparkles,
  Star,
  Rocket,
  Bot,
  Blocks,
  Code2,
  Cpu,
  Trophy,
  HeartHandshake,
  ShieldCheck,
  MessageCircle,
  Phone,
  MapPin,
  Mail,
  Menu,
  ArrowLeft,
  Quote,
} from "lucide-react";
import { Button } from "@workspace/funademy-ds/components/ui/button";
import { Badge } from "@workspace/funademy-ds/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/funademy-ds/components/ui/card";
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
import { cn } from "@workspace/funademy-ds/lib/utils";

const IMG = (name: string) => `/__mockup/images/${name}`;

/* ---------------- Decorative helpers ---------------- */

function FloatingBlob({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute rounded-full blur-2xl", className)}
      style={{ backgroundColor: color }}
    />
  );
}

function StarBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white shadow-lg",
        className,
      )}
      style={{ backgroundColor: "var(--color-chart-2, #FFCA17)" }}
    >
      <Star className="h-5 w-5 fill-[#101A38] text-[#101A38]" />
    </span>
  );
}

/* ---------------- Header ---------------- */

function Header() {
  const nav = ["البرامج", "لماذا فن أكاديمي", "آراء الأهالي", "الأسئلة الشائعة"];
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#091D52]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-primary-foreground"
            style={{ backgroundColor: "var(--color-chart-3, #22DAFF)" }}
          >
            <Bot className="h-6 w-6 text-[#101A38]" />
          </span>
          <div className="leading-tight text-white">
            <div className="font-serif text-lg font-extrabold">فن أكاديمي</div>
            <div className="text-[11px] text-white/60">FunAdemy · الرياض</div>
          </div>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <a
              key={item}
              href="#"
              className="text-sm font-semibold text-white/80 transition-colors hover:text-white"
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            className="hidden font-bold text-[#101A38] sm:inline-flex"
            style={{ backgroundColor: "var(--color-chart-2, #FFCA17)", borderColor: "var(--color-chart-2, #FFCA17)" }}
          >
            <Sparkles className="h-4 w-4" />
            احجز حصة تجريبية
          </Button>
          <Button variant="ghost" size="icon" className="text-white md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#091D52] pb-16 pt-12 text-white sm:pb-24 sm:pt-16">
      <FloatingBlob className="right-[-60px] top-10 h-56 w-56 opacity-40" color="#22DAFF" />
      <FloatingBlob className="left-[-40px] bottom-0 h-64 w-64 opacity-30" color="#8B5CF6" />
      <FloatingBlob className="left-1/3 top-24 h-40 w-40 opacity-20" color="#FF7A59" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2">
        <div>
          <Badge
            className="mb-5 border-transparent px-3 py-1 text-[#101A38]"
            style={{ backgroundColor: "var(--color-chart-2, #FFCA17)" }}
          >
            <Star className="h-3.5 w-3.5 fill-[#101A38]" />
            الأعمار ٤ – ١٨ سنة
          </Badge>

          <h1 className="font-serif text-4xl font-extrabold leading-tight sm:text-5xl">
            نصنع مهندسين
            <span style={{ color: "var(--color-chart-3, #22DAFF)" }}> صغار</span>
            <br />
            بطريقة{" "}
            <span style={{ color: "var(--color-chart-2, #FFCA17)" }}>ممتعة!</span>
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
            برامج ليغو® وروبوتات وبرمجة حقيقية للأطفال في الرياض — حصص تفاعلية
            بالعربية يبني فيها طفلك، يبرمج، ويكتشف عالم الهندسة وهو يلعب.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="font-bold text-[#101A38]"
              style={{ backgroundColor: "var(--color-chart-2, #FFCA17)", borderColor: "var(--color-chart-2, #FFCA17)" }}
            >
              <Rocket className="h-5 w-5" />
              احجز حصة تجريبية مجانية
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/40 font-bold text-white"
            >
              تصفّح البرامج
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-white/70">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" style={{ color: "var(--color-chart-3, #22DAFF)" }} />
              مدربون معتمدون
            </span>
            <span className="flex items-center gap-1.5">
              <HeartHandshake className="h-4 w-4" style={{ color: "var(--color-chart-3, #22DAFF)" }} />
              مجموعات صغيرة
            </span>
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4" style={{ color: "var(--color-chart-3, #22DAFF)" }} />
              شهادات إنجاز
            </span>
          </div>
        </div>

        {/* Hero visual */}
        <div className="relative">
          <div
            className="relative overflow-hidden rounded-[2.5rem] border-4 border-white/15 shadow-2xl"
            style={{ backgroundColor: "var(--color-chart-3, #22DAFF)" }}
          >
            <img
              src={IMG("hero-kids-robotics.png")}
              alt="أطفال يبنون روبوتات في فن أكاديمي"
              className="h-full w-full object-cover"
            />
          </div>

          {/* floating cards */}
          <div className="absolute -right-3 -top-4 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[#101A38] shadow-xl">
            <StarBadge />
            <div className="leading-tight">
              <div className="font-serif text-lg font-extrabold">١٠٠٪</div>
              <div className="text-xs text-[#5F6B92]">متعة التعلّم</div>
            </div>
          </div>
          <div
            className="absolute -bottom-4 -left-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-white shadow-xl"
            style={{ backgroundColor: "var(--color-chart-4, #8B5CF6)" }}
          >
            <Bot className="h-8 w-8" />
            <div className="leading-tight">
              <div className="font-serif text-base font-extrabold">روبوت جديد</div>
              <div className="text-xs text-white/80">كل أسبوع!</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Stats strip ---------------- */

const STATS = [
  { value: "+٢٥٠٠", label: "طالب وطالبة", color: "#22DAFF", icon: Sparkles },
  { value: "+٩", label: "سنوات خبرة", color: "#FFCA17", icon: Trophy },
  { value: "٤", label: "فروع في الرياض", color: "#8B5CF6", icon: MapPin },
  { value: "٪٩٨", label: "رضا الأهالي", color: "#FF7A59", icon: HeartHandshake },
];

function StatsStrip() {
  return (
    <section className="mx-auto -mt-10 max-w-6xl px-4">
      <div className="grid grid-cols-2 gap-3 rounded-[2rem] border border-border bg-card p-4 shadow-xl sm:gap-4 sm:p-6 md:grid-cols-4">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl bg-muted/60 p-4"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#101A38]"
                style={{ backgroundColor: s.color }}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div className="leading-tight">
                <div className="font-serif text-2xl font-extrabold text-foreground">
                  {s.value}
                </div>
                <div className="text-xs font-semibold text-muted-foreground">
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Programs ---------------- */

const PROGRAMS = [
  {
    band: "٤ – ٦ سنوات",
    name: "روبوتيكس مبكر",
    en: "Early Robotics",
    tagline:
      "أول خطوات طفلك في عالم البناء والحركة — قطع كبيرة آمنة، قصص ممتعة، وأول روبوت متحرك.",
    color: "#22DAFF",
    icon: Cpu,
    art: "prog-early.png",
    tags: ["بناء حسّي", "حكايات", "حركة"],
  },
  {
    band: "٧ – ١٢ سنة",
    name: "هندسة ليغو وروبوتات",
    en: "LEGO Engineering",
    tagline:
      "تروس ومحركات وأجهزة استشعار — يبني طفلك آلات حقيقية ويبرمجها لتنفّذ مهام مذهلة.",
    color: "#8B5CF6",
    icon: Blocks,
    art: "prog-lego.png",
    tags: ["ميكانيكا", "برمجة بلوكات", "تحدّيات"],
  },
  {
    band: "١٣ – ١٨ سنة",
    name: "برمجة وروبوتات متقدمة",
    en: "Advanced Coding",
    tagline:
      "برمجة نصية حقيقية، روبوتات ذكية، وذكاء اصطناعي — مشاريع تؤهّل للمسابقات الوطنية.",
    color: "#FF7A59",
    icon: Code2,
    art: "prog-code.png",
    tags: ["Python", "روبوتات ذكية", "مسابقات"],
  },
];

function Programs() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="secondary" className="mb-3 font-bold">
          برامجنا حسب العمر
        </Badge>
        <h2 className="font-serif text-3xl font-extrabold text-foreground sm:text-4xl">
          رحلة هندسية تكبر مع طفلك
        </h2>
        <p className="mt-3 text-muted-foreground">
          ثلاث مراحل مصمّمة بعناية — من أول مكعّب حتى أول روبوت ذكي يبنيه بنفسه.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PROGRAMS.map((p) => {
          const Icon = p.icon;
          return (
            <Card
              key={p.name}
              className="group relative overflow-hidden rounded-[2rem] border-2 border-transparent shadow-lg transition-transform duration-300 hover:-translate-y-1"
            >
              {/* colored top */}
              <div
                className="relative h-40 overflow-hidden"
                style={{ backgroundColor: p.color }}
              >
                <FloatingBlob
                  className="right-4 top-4 h-16 w-16 opacity-40"
                  color="#ffffff"
                />
                <StarBadge className="absolute left-4 top-4 z-10" />
                <img
                  src={IMG(p.art)}
                  alt={p.name}
                  className="absolute bottom-0 left-1/2 h-36 -translate-x-1/2 object-contain drop-shadow-xl transition-transform duration-300 group-hover:scale-105"
                />
                <Badge className="absolute bottom-3 right-4 z-10 border-transparent bg-white/90 font-bold text-[#101A38]">
                  {p.band}
                </Badge>
              </div>

              <CardHeader className="pb-2">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-[#101A38]"
                    style={{ backgroundColor: `${p.color}33` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: p.color }} />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {p.en}
                  </span>
                </div>
                <CardTitle className="font-serif text-xl font-extrabold">
                  {p.name}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {p.tagline}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <Badge key={t} variant="outline" className="rounded-full font-semibold">
                      {t}
                    </Badge>
                  ))}
                </div>
                <Button
                  className="mt-5 w-full font-bold text-primary-foreground"
                  style={{ backgroundColor: p.color, borderColor: p.color }}
                >
                  احجز تجربة مجانية
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Why us ---------------- */

const WHY = [
  {
    icon: Blocks,
    title: "نبني بأيدينا",
    text: "كل حصة مشروع عملي — لا شرح نظري ممل، بل بناء وتجربة واكتشاف.",
    color: "#22DAFF",
  },
  {
    icon: HeartHandshake,
    title: "مجموعات صغيرة",
    text: "٦ أطفال كحدّ أقصى مع كل مدرب، لاهتمام حقيقي بكل طفل.",
    color: "#8B5CF6",
  },
  {
    icon: ShieldCheck,
    title: "منهج معتمد",
    text: "برامج عالمية مطوّرة لتناسب أطفالنا ولغتنا وثقافتنا.",
    color: "#FF7A59",
  },
  {
    icon: Trophy,
    title: "نحتفل بالإنجاز",
    text: "نجوم ذهبية، شهادات، ومشاركة في المسابقات الوطنية.",
    color: "#FFCA17",
  },
];

function WhyUs() {
  return (
    <section className="bg-secondary/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3 border border-border bg-card font-bold">
            لماذا فن أكاديمي؟
          </Badge>
          <h2 className="font-serif text-3xl font-extrabold text-foreground sm:text-4xl">
            تعلّم يشبه اللعب تماماً
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => {
            const Icon = w.icon;
            return (
              <Card
                key={w.title}
                className="rounded-[1.75rem] border-border text-center shadow-sm transition-transform duration-300 hover:-translate-y-1"
              >
                <CardContent className="pt-6">
                  <span
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-[#101A38]"
                    style={{ backgroundColor: w.color }}
                  >
                    <Icon className="h-7 w-7" />
                  </span>
                  <h3 className="font-serif text-lg font-extrabold text-foreground">
                    {w.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {w.text}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Testimonials ---------------- */

const TESTIMONIALS = [
  {
    name: "أم عبدالله",
    role: "ولية أمر — فرع الملقا",
    text: "ابني صار ينتظر يوم الحصة بفارغ الصبر! يبني روبوتات في البيت ويشرح لنا كيف تشتغل. تطوّر ملحوظ في تركيزه وثقته.",
    color: "#22DAFF",
  },
  {
    name: "أبو ريان",
    role: "ولي أمر — فرع النرجس",
    text: "المدرّبون رائعون والمجموعات صغيرة فعلاً. ريان تعلّم البرمجة وهو يستمتع، وشارك في مسابقة الروبوت وفاز بالمركز الثاني!",
    color: "#8B5CF6",
  },
  {
    name: "أم لُجين",
    role: "ولية أمر — فرع قرطبة",
    text: "بنتي عمرها ٥ سنوات وتحب برنامج الروبوتيكس المبكر. القطع آمنة والأنشطة ممتعة، وتعود سعيدة كل مرة.",
    color: "#FF7A59",
  },
];

function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="secondary" className="mb-3 font-bold">
          آراء الأهالي
        </Badge>
        <h2 className="font-serif text-3xl font-extrabold text-foreground sm:text-4xl">
          عائلات سعيدة، أطفال مبدعون
        </h2>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <Card key={t.name} className="relative rounded-[1.75rem] border-border shadow-sm">
            <CardContent className="pt-6">
              <Quote
                className="mb-3 h-8 w-8"
                style={{ color: t.color }}
              />
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-[#FFCA17] text-[#FFCA17]"
                  />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-foreground">{t.text}</p>
              <Separator className="my-4" />
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback
                    className="font-bold text-[#101A38]"
                    style={{ backgroundColor: `${t.color}55` }}
                  >
                    {t.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <div className="font-bold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

const FAQS = [
  {
    q: "هل تناسب البرامج المبتدئين تماماً؟",
    a: "نعم! نبدأ من الصفر ونتدرّج مع كل طفل حسب مستواه وعمره — لا حاجة لأي خبرة سابقة.",
  },
  {
    q: "كم مدة الحصة وكم عدد الأطفال؟",
    a: "الحصة من ٦٠ إلى ٩٠ دقيقة حسب المرحلة، وبحد أقصى ٦ أطفال مع كل مدرب لضمان اهتمام كافٍ.",
  },
  {
    q: "هل الأدوات والروبوتات متوفرة في الفرع؟",
    a: "بالطبع، جميع مجموعات ليغو® والروبوتات والأجهزة متوفرة داخل الفرع — يكفي أن يحضر طفلك بحماسه!",
  },
  {
    q: "كيف أحجز حصة تجريبية مجانية؟",
    a: "اضغط على زر «احجز حصة تجريبية مجانية» أو راسلنا على واتساب، وسنرشّح لك البرنامج المناسب لعمر طفلك.",
  },
];

function FAQ() {
  return (
    <section className="bg-secondary/60 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-10 text-center">
          <Badge variant="secondary" className="mb-3 border border-border bg-card font-bold">
            الأسئلة الشائعة
          </Badge>
          <h2 className="font-serif text-3xl font-extrabold text-foreground sm:text-4xl">
            كل ما تريد معرفته
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {FAQS.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-2xl border border-border bg-card px-4"
            >
              <AccordionTrigger className="text-right font-bold text-foreground hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* ---------------- CTA ---------------- */

function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[#091D52] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
        <FloatingBlob className="right-8 top-6 h-40 w-40 opacity-30" color="#22DAFF" />
        <FloatingBlob className="left-8 bottom-6 h-48 w-48 opacity-25" color="#FF7A59" />
        <div className="relative mx-auto max-w-xl">
          <img
            src={IMG("robot-mascot.png")}
            alt="روبوت فن أكاديمي"
            className="mx-auto mb-4 h-24 w-24 object-contain drop-shadow-xl"
          />
          <h2 className="font-serif text-3xl font-extrabold sm:text-4xl">
            جاهز يبدأ طفلك رحلة الهندسة؟
          </h2>
          <p className="mt-3 text-white/80">
            احجز حصة تجريبية مجانية اليوم، ودع طفلك يكتشف شغفه القادم بين المكعّبات
            والروبوتات.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              className="font-bold text-[#101A38]"
              style={{ backgroundColor: "var(--color-chart-2, #FFCA17)", borderColor: "var(--color-chart-2, #FFCA17)" }}
            >
              <Rocket className="h-5 w-5" />
              احجز حصة تجريبية مجانية
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/40 font-bold text-white"
            >
              <MessageCircle className="h-5 w-5" />
              تواصل عبر واتساب
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  return (
    <footer className="bg-[#091D52] text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--color-chart-3, #22DAFF)" }}
            >
              <Bot className="h-5 w-5 text-[#101A38]" />
            </span>
            <span className="font-serif text-lg font-extrabold">فن أكاديمي</span>
          </div>
          <p className="text-sm leading-relaxed text-white/70">
            أكاديمية هندسة للأطفال في الرياض — نصنع مهندسي المستقبل بمتعة ليغو®
            والروبوتات والبرمجة.
          </p>
        </div>

        <div>
          <div className="mb-3 font-bold">البرامج</div>
          <ul className="space-y-2 text-sm text-white/70">
            <li><a href="#" className="hover:text-white">روبوتيكس مبكر (٤–٦)</a></li>
            <li><a href="#" className="hover:text-white">هندسة ليغو (٧–١٢)</a></li>
            <li><a href="#" className="hover:text-white">برمجة متقدمة (١٣–١٨)</a></li>
            <li><a href="#" className="hover:text-white">المخيمات الصيفية</a></li>
          </ul>
        </div>

        <div>
          <div className="mb-3 font-bold">الأكاديمية</div>
          <ul className="space-y-2 text-sm text-white/70">
            <li><a href="#" className="hover:text-white">من نحن</a></li>
            <li><a href="#" className="hover:text-white">الفروع</a></li>
            <li><a href="#" className="hover:text-white">المدرّبون</a></li>
            <li><a href="#" className="hover:text-white">انضم لفريقنا</a></li>
          </ul>
        </div>

        <div>
          <div className="mb-3 font-bold">تواصل معنا</div>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4" style={{ color: "var(--color-chart-3, #22DAFF)" }} />
              ٩٢٠ ٠٠٠ ١٢٣
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" style={{ color: "var(--color-chart-3, #22DAFF)" }} />
              واتساب: ٠٥٥ ١٢٣ ٤٥٦٧
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4" style={{ color: "var(--color-chart-3, #22DAFF)" }} />
              hello@funademy.io
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4" style={{ color: "var(--color-chart-3, #22DAFF)" }} />
              الرياض — ٤ فروع
            </li>
          </ul>
          <Button
            className="mt-4 w-full font-bold text-[#101A38]"
            style={{ backgroundColor: "var(--color-chart-2, #FFCA17)", borderColor: "var(--color-chart-2, #FFCA17)" }}
          >
            <MessageCircle className="h-4 w-4" />
            راسلنا على واتساب
          </Button>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row">
          <span>© ٢٠٢٥ فن أكاديمي — جميع الحقوق محفوظة.</span>
          <span>صُنع بحب في الرياض 🇸🇦</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Page ---------------- */

export default function HomePlayful() {
  return (
    <div dir="rtl" className="min-h-[100dvh] bg-background font-sans text-foreground">
      <Header />
      <main>
        <Hero />
        <StatsStrip />
        <Programs />
        <WhyUs />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
