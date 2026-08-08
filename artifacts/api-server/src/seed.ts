/**
 * Seed script — demo data for Manara Academy.
 * Run: pnpm --filter @workspace/api-server exec tsx src/seed.ts
 */
import {
  db,
  usersTable,
  childrenTable,
  subjectsTable,
  unitsTable,
  lessonsTable,
  exercisesTable,
  completionsTable,
  subscriptionsTable,
  invoicesTable,
  blogPostsTable,
} from "@workspace/db";
import { hashPassword, hashPin } from "./lib/auth";

const SAMPLE_VIDEOS = [
  "https://www.youtube.com/watch?v=Xn9SC7EowXA",
  "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
  "https://www.youtube.com/watch?v=kXYiU_JCYtU",
];

type ExSeed = {
  type: string;
  promptAr: string;
  promptEn: string;
  options: string[];
  correctAnswer: string;
};

function mcq(promptAr: string, promptEn: string, options: string[], correct: string): ExSeed {
  return { type: "multiple_choice", promptAr, promptEn, options, correctAnswer: correct };
}
function fill(promptAr: string, promptEn: string, answer: string): ExSeed {
  return { type: "fill_blank", promptAr, promptEn, options: [], correctAnswer: answer };
}
function pick(promptAr: string, promptEn: string, options: string[], correct: string): ExSeed {
  return { type: "picture_select", promptAr, promptEn, options, correctAnswer: correct };
}
function match(promptAr: string, promptEn: string, pairs: string[]): ExSeed {
  return { type: "matching", promptAr, promptEn, options: pairs, correctAnswer: pairs.join("|") };
}

async function main() {
  const existing = await db.select().from(usersTable);
  if (existing.length > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  // ---- Users ----
  const [parent] = await db
    .insert(usersTable)
    .values({
      name: "أحمد العتيبي",
      email: "parent@demo.manara.sa",
      passwordHash: hashPassword("Demo1234"),
      pin: hashPin("1234"),
      role: "parent",
    })
    .returning();
  const [teacher] = await db
    .insert(usersTable)
    .values({
      name: "أ. نورة القحطاني",
      email: "teacher@demo.manara.sa",
      passwordHash: hashPassword("Demo1234"),
      pin: hashPin("1234"),
      role: "teacher",
    })
    .returning();
  await db.insert(usersTable).values({
    name: "مشرف المنصة",
    email: "admin@demo.manara.sa",
    passwordHash: hashPassword("Demo1234"),
    pin: hashPin("1234"),
    role: "admin",
  });

  const [salman] = await db
    .insert(childrenTable)
    .values({
      parentId: parent!.id,
      name: "سلمان",
      avatar: "lion",
      band: "explorers",
      birthYear: 2020,
      birthMonth: 3,
      pin: hashPin("1111"),
      xp: 150,
      streak: 2,
      badges: ["first_lesson"],
      dailyLimitMinutes: 45,
    })
    .returning();
  const [layan] = await db
    .insert(childrenTable)
    .values({
      parentId: parent!.id,
      name: "ليان",
      avatar: "cat",
      band: "builders",
      birthYear: 2016,
      birthMonth: 9,
      pin: hashPin("2222"),
      xp: 400,
      streak: 5,
      badges: ["first_lesson", "five_lessons", "streak_3"],
      dailyLimitMinutes: null,
    })
    .returning();

  await db.insert(subscriptionsTable).values({
    userId: parent!.id,
    status: "trial",
    plan: "annual",
    trialEndsAt: new Date(Date.now() + 5 * 86400000),
    currentPeriodEnd: new Date(Date.now() + 370 * 86400000),
    priceSar: 399,
    cardLast4: "4242",
  });
  await db.insert(invoicesTable).values({
    userId: parent!.id,
    amountSar: 0,
    status: "trial",
    description: "بداية التجربة المجانية — خطة سنوية (399 ر.س بعد التجربة)",
  });

  // ---- Subjects ----
  const [math] = await db
    .insert(subjectsTable)
    .values({ nameAr: "الرياضيات", nameEn: "Math", slug: "math", icon: "calculator", color: "#2563EB" })
    .returning();
  const [arabic] = await db
    .insert(subjectsTable)
    .values({ nameAr: "اللغة العربية", nameEn: "Arabic", slug: "arabic", icon: "book-open", color: "#059669" })
    .returning();
  await db.insert(subjectsTable).values([
    { nameAr: "اللغة الإنجليزية", nameEn: "English", slug: "english", icon: "languages", color: "#D97706" },
    { nameAr: "العلوم", nameEn: "Science", slug: "science", icon: "flask-conical", color: "#7C3AED" },
  ]);

  // ---- Curriculum: subject × band → 3 units × 4 lessons × 5 exercises ----
  const plans: Array<{
    subjectId: number;
    band: string;
    units: Array<{ titleAr: string; titleEn: string; lessons: Array<{ titleAr: string; titleEn: string; descAr: string }> }>;
  }> = [
    {
      subjectId: math!.id,
      band: "explorers",
      units: [
        {
          titleAr: "الأعداد من 1 إلى 10",
          titleEn: "Numbers 1–10",
          lessons: [
            { titleAr: "نتعرف على الأعداد 1 و2 و3", titleEn: "Meet numbers 1, 2, 3", descAr: "نعد الأشياء من حولنا ونتعلم شكل الأعداد الأولى." },
            { titleAr: "الأعداد 4 و5 و6", titleEn: "Numbers 4, 5, 6", descAr: "نكمل رحلة العد مع ألعاب ممتعة." },
            { titleAr: "الأعداد 7 و8 و9 و10", titleEn: "Numbers 7 to 10", descAr: "نصل إلى العشرة ونحتفل بالعد الكامل." },
            { titleAr: "نعد الأشياء حولنا", titleEn: "Counting around us", descAr: "نستخدم الأعداد في حياتنا اليومية." },
          ],
        },
        {
          titleAr: "الأشكال الهندسية",
          titleEn: "Shapes",
          lessons: [
            { titleAr: "الدائرة والمربع", titleEn: "Circle and square", descAr: "نتعرف على أول شكلين هندسيين." },
            { titleAr: "المثلث والمستطيل", titleEn: "Triangle and rectangle", descAr: "أشكال جديدة نراها كل يوم." },
            { titleAr: "الأشكال في بيتنا", titleEn: "Shapes at home", descAr: "نبحث عن الأشكال في غرفتنا ومطبخنا." },
            { titleAr: "نرسم بالأشكال", titleEn: "Drawing with shapes", descAr: "نصنع لوحة جميلة من الأشكال." },
          ],
        },
        {
          titleAr: "الجمع البسيط",
          titleEn: "Simple addition",
          lessons: [
            { titleAr: "ما معنى الجمع؟", titleEn: "What is addition?", descAr: "نجمع الأشياء معاً ونعدها." },
            { titleAr: "نجمع حتى 5", titleEn: "Adding up to 5", descAr: "تمارين جمع سهلة وممتعة." },
            { titleAr: "نجمع حتى 10", titleEn: "Adding up to 10", descAr: "نتحدى أنفسنا بأعداد أكبر." },
            { titleAr: "قصص الجمع", titleEn: "Addition stories", descAr: "مسائل كلامية من حياة الأطفال." },
          ],
        },
      ],
    },
    {
      subjectId: math!.id,
      band: "builders",
      units: [
        {
          titleAr: "الضرب والقسمة",
          titleEn: "Multiplication & division",
          lessons: [
            { titleAr: "جدول الضرب 2 و3", titleEn: "Times tables 2 & 3", descAr: "نحفظ الجداول الأولى بطريقة ذكية." },
            { titleAr: "جدول الضرب 4 و5", titleEn: "Times tables 4 & 5", descAr: "نكمل الجداول مع تمارين سريعة." },
            { titleAr: "مفهوم القسمة", titleEn: "Understanding division", descAr: "القسمة هي التوزيع بالعدل." },
            { titleAr: "الضرب والقسمة معاً", titleEn: "Multiply & divide", descAr: "العلاقة بين العمليتين." },
          ],
        },
        {
          titleAr: "الكسور",
          titleEn: "Fractions",
          lessons: [
            { titleAr: "ما هو الكسر؟", titleEn: "What is a fraction?", descAr: "نقسم البيتزا ونتعلم الأنصاف والأرباع." },
            { titleAr: "مقارنة الكسور", titleEn: "Comparing fractions", descAr: "أيهما أكبر: النصف أم الربع؟" },
            { titleAr: "جمع الكسور المتشابهة", titleEn: "Adding like fractions", descAr: "نجمع كسوراً لها نفس المقام." },
            { titleAr: "الكسور في حياتنا", titleEn: "Fractions in life", descAr: "الوقت والنقود والطبخ كلها كسور." },
          ],
        },
        {
          titleAr: "القياس والهندسة",
          titleEn: "Measurement & geometry",
          lessons: [
            { titleAr: "وحدات الطول", titleEn: "Units of length", descAr: "السنتيمتر والمتر والكيلومتر." },
            { titleAr: "المحيط", titleEn: "Perimeter", descAr: "نقيس حدود الأشكال." },
            { titleAr: "المساحة", titleEn: "Area", descAr: "كم مربعاً يغطي الشكل؟" },
            { titleAr: "الزوايا", titleEn: "Angles", descAr: "قائمة وحادة ومنفرجة." },
          ],
        },
      ],
    },
    {
      subjectId: arabic!.id,
      band: "explorers",
      units: [
        {
          titleAr: "الحروف الهجائية (أ - خ)",
          titleEn: "Letters A–Kh",
          lessons: [
            { titleAr: "حرف الألف والباء", titleEn: "Alif & Baa", descAr: "أول حرفين في رحلتنا مع كلمات مصورة." },
            { titleAr: "حرف التاء والثاء", titleEn: "Taa & Thaa", descAr: "نميز بين النقاط ونكتب الحروف." },
            { titleAr: "حرف الجيم والحاء", titleEn: "Jeem & Haa", descAr: "حروف جديدة مع أناشيد ممتعة." },
            { titleAr: "حرف الخاء ومراجعة", titleEn: "Khaa & review", descAr: "نراجع كل ما تعلمناه بلعبة شيقة." },
          ],
        },
        {
          titleAr: "الحروف الهجائية (د - ص)",
          titleEn: "Letters D–S",
          lessons: [
            { titleAr: "حرف الدال والذال", titleEn: "Dal & Thal", descAr: "نتعلم النطق الصحيح والكتابة." },
            { titleAr: "حرف الراء والزاي", titleEn: "Raa & Zay", descAr: "حروف متشابهة نفرق بينها." },
            { titleAr: "حرف السين والشين", titleEn: "Seen & Sheen", descAr: "ثلاث نقاط تصنع الفرق." },
            { titleAr: "حرف الصاد", titleEn: "Saad", descAr: "حرف قوي مع كلمات جديدة." },
          ],
        },
        {
          titleAr: "كلماتي الأولى",
          titleEn: "My first words",
          lessons: [
            { titleAr: "أفراد عائلتي", titleEn: "My family", descAr: "بابا وماما وأخي وأختي." },
            { titleAr: "ألوان حولي", titleEn: "Colors around me", descAr: "أحمر وأزرق وأخضر وأصفر." },
            { titleAr: "حيوانات أحبها", titleEn: "Animals I love", descAr: "أسد وقطة وجمل وخروف." },
            { titleAr: "جملتي الأولى", titleEn: "My first sentence", descAr: "نركب كلمات لنصنع جملة." },
          ],
        },
      ],
    },
    {
      subjectId: arabic!.id,
      band: "builders",
      units: [
        {
          titleAr: "القراءة والفهم",
          titleEn: "Reading comprehension",
          lessons: [
            { titleAr: "قصة الصياد والسمكة", titleEn: "The fisherman story", descAr: "نقرأ قصة ونجيب عن الأسئلة." },
            { titleAr: "الفكرة الرئيسية", titleEn: "Main idea", descAr: "كيف نجد فكرة النص الرئيسية؟" },
            { titleAr: "التفاصيل المهمة", titleEn: "Key details", descAr: "نبحث عن التفاصيل الداعمة." },
            { titleAr: "نستنتج ونتوقع", titleEn: "Inference", descAr: "نقرأ بين السطور." },
          ],
        },
        {
          titleAr: "قواعد النحو الأساسية",
          titleEn: "Basic grammar",
          lessons: [
            { titleAr: "الاسم والفعل والحرف", titleEn: "Noun, verb, particle", descAr: "أقسام الكلام الثلاثة." },
            { titleAr: "الجملة الاسمية", titleEn: "Nominal sentence", descAr: "المبتدأ والخبر." },
            { titleAr: "الجملة الفعلية", titleEn: "Verbal sentence", descAr: "الفعل والفاعل." },
            { titleAr: "أدوات الاستفهام", titleEn: "Question words", descAr: "من وماذا ومتى وأين ولماذا." },
          ],
        },
        {
          titleAr: "الإملاء والكتابة",
          titleEn: "Spelling & writing",
          lessons: [
            { titleAr: "التاء المربوطة والمفتوحة", titleEn: "Taa marbuta", descAr: "متى نكتب ة ومتى نكتب ت؟" },
            { titleAr: "همزة القطع والوصل", titleEn: "Hamza rules", descAr: "قاعدة سهلة نطبقها دائماً." },
            { titleAr: "اللام الشمسية والقمرية", titleEn: "Sun & moon letters", descAr: "الفرق في النطق والكتابة." },
            { titleAr: "أكتب فقرة قصيرة", titleEn: "Writing a paragraph", descAr: "نرتب أفكارنا ونكتبها." },
          ],
        },
      ],
    },
  ];

  const exerciseBank: Record<string, (lessonTitle: string) => ExSeed[]> = {
    explorers: (t) => [
      mcq(`في درس «${t}»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎`, "How many apples?", ["2", "3", "4", "5"], "3"),
      pick("اختر الشكل الصحيح: الدائرة", "Pick the circle", ["دائرة", "مربع", "مثلث", "نجمة"], "دائرة"),
      mcq("ما ناتج 2 + 1؟", "What is 2 + 1?", ["1", "2", "3", "4"], "3"),
      fill("أكمل: واحد، اثنان، ____", "Complete: one, two, ___", "ثلاثة"),
      match("صل العدد بالصورة", "Match number to picture", ["1=🍎", "2=🍎🍎", "3=🍎🍎🍎"]),
    ],
    builders: (t) => [
      mcq(`في درس «${t}»: ما ناتج 3 × 4؟`, "What is 3 × 4?", ["7", "10", "12", "14"], "12"),
      mcq("أي كسر أكبر؟", "Which fraction is bigger?", ["النصف", "الربع", "الثمن", "العشر"], "النصف"),
      fill("أكمل: 5 × 5 = ____", "Complete: 5 × 5 = ___", "25"),
      mcq("اختر الجملة الاسمية:", "Pick the nominal sentence", ["السماء صافية", "ذهب الولد", "اكتب الدرس", "هل جئت؟"], "السماء صافية"),
      match("صل العملية بناتجها", "Match operation to result", ["2×3=6", "4×2=8", "5×2=10"]),
    ],
  };

  const now = Date.now();
  const salmanCompletions: Array<{ lessonId: number; score: number; daysAgo: number }> = [];
  const layanCompletions: Array<{ lessonId: number; score: number; daysAgo: number }> = [];

  for (const plan of plans) {
    let unitPos = 0;
    for (const unit of plan.units) {
      const [u] = await db
        .insert(unitsTable)
        .values({
          subjectId: plan.subjectId,
          band: plan.band,
          titleAr: unit.titleAr,
          titleEn: unit.titleEn,
          position: unitPos,
          status: "published",
        })
        .returning();
      let lessonPos = 0;
      for (const lesson of unit.lessons) {
        const [l] = await db
          .insert(lessonsTable)
          .values({
            unitId: u!.id,
            titleAr: lesson.titleAr,
            titleEn: lesson.titleEn,
            descriptionAr: lesson.descAr,
            descriptionEn: "",
            videoUrl: SAMPLE_VIDEOS[lessonPos % SAMPLE_VIDEOS.length]!,
            videoType: "youtube",
            durationMinutes: 6 + (lessonPos % 3) * 2,
            position: lessonPos,
            status: "published",
            isFreeSample: unitPos === 0 && lessonPos === 0,
          })
          .returning();
        const bank = exerciseBank[plan.band]!(lesson.titleAr);
        await db.insert(exercisesTable).values(
          bank.map((e, i) => ({ lessonId: l!.id, ...e, position: i })),
        );
        // demo progress
        if (plan.band === "explorers" && unitPos === 0 && lessonPos < 3) {
          salmanCompletions.push({ lessonId: l!.id, score: [100, 80, 60][lessonPos]!, daysAgo: 3 - lessonPos });
        }
        if (plan.band === "builders" && unitPos < 2 && lessonPos < 4 && salmanCompletions.length + layanCompletions.length < 20) {
          if (unitPos === 0 || lessonPos < 2) {
            layanCompletions.push({ lessonId: l!.id, score: [95, 88, 72, 55][lessonPos]!, daysAgo: (unitPos * 4 + lessonPos) % 7 });
          }
        }
        lessonPos++;
      }
      unitPos++;
    }
  }

  for (const c of salmanCompletions) {
    await db.insert(completionsTable).values({
      childId: salman!.id,
      lessonId: c.lessonId,
      score: c.score,
      timeSpentSeconds: 420,
      createdAt: new Date(now - c.daysAgo * 86400000),
    });
  }
  for (const c of layanCompletions) {
    await db.insert(completionsTable).values({
      childId: layan!.id,
      lessonId: c.lessonId,
      score: c.score,
      timeSpentSeconds: 600,
      createdAt: new Date(now - c.daysAgo * 86400000),
    });
  }

  // ---- Blog ----
  await db.insert(blogPostsTable).values([
    {
      slug: "screen-time-balance",
      titleAr: "كيف توازن بين وقت الشاشة والتعلم؟",
      excerptAr: "وقت الشاشة ليس عدواً إذا كان محتواه تعليمياً هادفاً. إليك 5 قواعد عملية للأسرة السعودية.",
      contentAr:
        "يقضي الطفل السعودي في المتوسط أكثر من 3 ساعات يومياً أمام الشاشات. السؤال ليس «كم»، بل «ماذا يشاهد؟»\n\n1. حدد وقتاً ثابتاً للتعلم الرقمي — 30 إلى 45 دقيقة كافية.\n2. اجعل التعلم قبل الترفيه، وليس بعده.\n3. استخدم أدوات التحكم الأبوي وحدود الوقت اليومية.\n4. شارك طفلك: اسأله عمّا تعلمه اليوم.\n5. كافئ الاستمرارية لا السرعة — الشارات والنقاط وسيلة وليست غاية.\n\nفي منارة، صممنا كل درس ليكون أقصر من 10 دقائق، مع حد يومي يضبطه الوالدان من لوحة التحكم.",
      coverEmoji: "⏰",
    },
    {
      slug: "learning-through-play",
      titleAr: "التعلم باللعب: لماذا يتذكر طفلك الألعاب وينسى الدروس؟",
      excerptAr: "الدماغ يتعلم أفضل عندما يستمتع. نشرح علم التلعيب وكيف نطبقه في منارة.",
      contentAr:
        "عندما يلعب الطفل، يفرز دماغه الدوبامين — وهو نفس الناقل العصبي المسؤول عن تثبيت الذكريات.\n\nلهذا صممنا منارة حول ثلاث ركائز:\n\n**النقاط والمستويات:** كل درس مكتمل يمنح نقاط خبرة تتراكم.\n**السلاسل اليومية:** المواظبة يوماً بعد يوم تبني عادة التعلم.\n**الشارات:** إنجازات ملموسة يفخر بها الطفل.\n\nالنتيجة؟ طفل يطلب الدرس بنفسه، بدل أن تطارده به.",
      coverEmoji: "🎮",
    },
    {
      slug: "saudi-curriculum-guide",
      titleAr: "دليل الوالدين للمنهج السعودي الجديد",
      excerptAr: "ما الذي تغير في مناهج وزارة التعليم؟ وكيف تدعم طفلك في كل مرحلة؟",
      contentAr:
        "شهدت المناهج السعودية تطويراً مستمراً ضمن رؤية 2030، مع تركيز أكبر على المهارات التطبيقية.\n\n**المرحلة الابتدائية:** التركيز على أساسيات القراءة والحساب.\n**المرحلة المتوسطة:** التفكير الناقد وحل المشكلات.\n**المرحلة الثانوية:** نظام المسارات الجديد.\n\nمحتوى منارة مُرتب على نفس تسلسل المنهج الوطني، لذا ما يتعلمه طفلك عندنا يدعم مباشرة ما يدرسه في المدرسة.",
      coverEmoji: "📖",
    },
  ]);

  console.log("Seed complete.");
  console.log("Demo accounts (password: Demo1234, parent PIN: 1234):");
  console.log("  parent@demo.manara.sa  (children: سلمان PIN 1111, ليان PIN 2222)");
  console.log("  teacher@demo.manara.sa");
  console.log("  admin@demo.manara.sa");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
