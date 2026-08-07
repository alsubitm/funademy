import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  lessonsTable,
  subjectsTable,
  blogPostsTable,
  campaignCountersTable,
  campaignBrickEventsTable,
} from "@workspace/db";
import { CreateBlogPostBody, PlaceBrickBody } from "@workspace/api-zod";
import { requireRole } from "../lib/auth";
import { priceFor } from "../lib/payments";

const router: IRouter = Router();

const BRICK_KEY = "watan-bricks";
// Campaign goal: bricks to reach before National Day (Sep 23)
const CAMPAIGN_GOAL = 100000;

router.get("/watan/bricks", async (_req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(campaignCountersTable)
    .where(eq(campaignCountersTable.key, BRICK_KEY));
  res.json({ count: row?.count ?? 0, goal: CAMPAIGN_GOAL });
});

router.post("/watan/bricks", async (req, res): Promise<void> => {
  const parsed = PlaceBrickBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid amount" });
    return;
  }
  const amount = parsed.data.amount ?? 1;
  const count = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(campaignCountersTable)
      .values({ key: BRICK_KEY, count: amount })
      .onConflictDoUpdate({
        target: campaignCountersTable.key,
        set: {
          count: sql`${campaignCountersTable.count} + ${amount}`,
        },
      })
      .returning();
    await tx
      .insert(campaignBrickEventsTable)
      .values({ key: BRICK_KEY, amount });
    return row!.count;
  });
  res.json({ count });
});

const NATIONAL_DAY = "2026-09-23";

router.get("/watan/stats", async (_req, res): Promise<void> => {
  const [counterRow] = await db
    .select()
    .from(campaignCountersTable)
    .where(eq(campaignCountersTable.key, BRICK_KEY));

  const dailyRows = await db
    .select({
      date: sql<string>`to_char((${campaignBrickEventsTable.createdAt} at time zone 'Asia/Riyadh')::date, 'YYYY-MM-DD')`,
      count: sql<number>`coalesce(sum(${campaignBrickEventsTable.amount}), 0)::int`,
    })
    .from(campaignBrickEventsTable)
    .where(eq(campaignBrickEventsTable.key, BRICK_KEY))
    .groupBy(
      sql`(${campaignBrickEventsTable.createdAt} at time zone 'Asia/Riyadh')::date`,
    )
    .orderBy(
      sql`(${campaignBrickEventsTable.createdAt} at time zone 'Asia/Riyadh')::date`,
    );

  // Build a continuous series over the last 14 days (Riyadh time)
  const now = new Date();
  const riyadhNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const todayStr = riyadhNow.toISOString().slice(0, 10);
  const byDate = new Map(dailyRows.map((r) => [r.date, r.count]));
  const daily: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(riyadhNow.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key, count: byDate.get(key) ?? 0 });
  }

  const today = byDate.get(todayStr) ?? 0;
  const yesterdayStr = new Date(riyadhNow.getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const yesterday = byDate.get(yesterdayStr) ?? 0;
  const growthPercent =
    yesterday > 0
      ? Math.round(((today - yesterday) / yesterday) * 1000) / 10
      : null;

  const nationalDayDate = new Date(`${NATIONAL_DAY}T00:00:00+03:00`);
  const daysRemaining = Math.max(
    0,
    Math.ceil((nationalDayDate.getTime() - now.getTime()) / 86400000),
  );

  const total = counterRow?.count ?? 0;
  const progressPercent =
    Math.round(Math.min(100, (total / CAMPAIGN_GOAL) * 100) * 10) / 10;

  res.json({
    total,
    goal: CAMPAIGN_GOAL,
    remaining: Math.max(0, CAMPAIGN_GOAL - total),
    progressPercent,
    today,
    yesterday,
    growthPercent,
    daysRemaining,
    nationalDay: NATIONAL_DAY,
    daily,
  });
});

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
