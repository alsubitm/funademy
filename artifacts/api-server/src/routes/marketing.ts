import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  lessonsTable,
  subjectsTable,
  blogPostsTable,
} from "@workspace/db";
import { CreateBlogPostBody } from "@workspace/api-zod";
import { requireRole } from "../lib/auth";
import { priceFor } from "../lib/payments";

const router: IRouter = Router();

const TESTIMONIALS = [
  {
    nameAr: "أم عبدالله",
    city: "الرياض",
    quoteAr:
      "أخيراً منصة عربية تناسب أعمار أولادي الثلاثة باشتراك واحد. ابني الصغير يطلب «درس منارة» كل مساء!",
    childrenCount: 3,
  },
  {
    nameAr: "أبو فيصل",
    city: "جدة",
    quoteAr:
      "التقارير الأسبوعية غيّرت طريقة متابعتي لمستوى بنتي. صرت أعرف بالضبط وين تحتاج مساعدة.",
    childrenCount: 2,
  },
  {
    nameAr: "أم لينا",
    city: "الدمام",
    quoteAr:
      "المحتوى مرتب على المنهج السعودي، والدروس قصيرة وممتعة. وفّرت علينا مدرّس خصوصي.",
    childrenCount: 1,
  },
];

const FAQ = [
  {
    questionAr: "هل يغطي الاشتراك جميع أطفالي؟",
    answerAr:
      "نعم، اشتراك عائلي واحد يغطي عدداً غير محدود من الأطفال في نفس المنزل، من عمر 4 حتى 18 سنة.",
  },
  {
    questionAr: "هل المحتوى متوافق مع المنهج السعودي؟",
    answerAr:
      "نعم، جميع الدروس مبنية على المنهج الوطني السعودي من الروضة حتى الصف الثالث الثانوي.",
  },
  {
    questionAr: "كيف تعمل التجربة المجانية؟",
    answerAr:
      "تحصل على 7 أيام مجانية كاملة الصلاحيات. يمكنك الإلغاء في أي وقت قبل انتهاء التجربة دون أي رسوم.",
  },
  {
    questionAr: "هل المنصة آمنة لأطفالي؟",
    answerAr:
      "بالتأكيد. لا إعلانات، لا روابط خارجية، لا محادثات. شاشات الأطفال معزولة تماماً وتحتاج رقم الوالدين السري للخروج منها.",
  },
  {
    questionAr: "هل يمكنني تحديد وقت استخدام لكل طفل؟",
    answerAr:
      "نعم، يمكنك تفعيل حد يومي لكل ملف طفل من لوحة تحكم الوالدين.",
  },
];

router.get("/marketing/content", async (_req, res): Promise<void> => {
  const [{ count: families }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.role, "parent"));
  const [{ count: lessons }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessonsTable);
  const [{ count: subjects }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subjectsTable);

  res.json({
    plans: [
      {
        plan: "monthly",
        priceSar: priceFor("monthly"),
        period: "شهرياً",
        savingsPercent: null,
      },
      {
        plan: "annual",
        priceSar: priceFor("annual"),
        period: "سنوياً",
        savingsPercent: 32,
      },
    ],
    testimonials: TESTIMONIALS,
    faq: FAQ,
    stats: {
      families: (families ?? 0) + 1240,
      lessons: lessons ?? 0,
      subjects: subjects ?? 0,
    },
  });
});

function serializePost(p: typeof blogPostsTable.$inferSelect) {
  return {
    id: p.id,
    slug: p.slug,
    titleAr: p.titleAr,
    excerptAr: p.excerptAr,
    contentAr: p.contentAr,
    coverEmoji: p.coverEmoji,
    publishedAt: p.publishedAt.toISOString(),
  };
}

router.get("/blog/posts", async (_req, res): Promise<void> => {
  const posts = await db
    .select()
    .from(blogPostsTable)
    .orderBy(desc(blogPostsTable.publishedAt));
  res.json(posts.map(serializePost));
});

router.post(
  "/blog/posts",
  requireRole("teacher", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateBlogPostBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid post" });
      return;
    }
    const [post] = await db
      .insert(blogPostsTable)
      .values(parsed.data)
      .returning();
    res.status(201).json(serializePost(post!));
  },
);

router.get("/blog/posts/:slug", async (req, res): Promise<void> => {
  const raw = req.params["slug"];
  const slug = Array.isArray(raw) ? raw[0]! : (raw as string);
  const [post] = await db
    .select()
    .from(blogPostsTable)
    .where(eq(blogPostsTable.slug, slug));
  if (!post) {
    res.status(404).json({ message: "Post not found" });
    return;
  }
  res.json(serializePost(post));
});

export default router;
