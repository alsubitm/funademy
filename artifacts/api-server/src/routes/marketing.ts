import fs from "node:fs";
import path from "node:path";
import { Router, type IRouter } from "express";
import { Resvg } from "@resvg/resvg-js";
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
import {
  CreateBlogPostBody,
  PlaceBrickBody,
  UpdateCampaignGoalBody,
} from "@workspace/api-zod";
import { requireRole } from "../lib/auth";
import { priceFor } from "../lib/payments";

const router: IRouter = Router();

const BRICK_KEY = "watan-bricks";
const GOAL_KEY = "watan-goal";
// Default campaign goal: bricks to reach before National Day (Sep 23)
const DEFAULT_CAMPAIGN_GOAL = 100000;

async function getCampaignGoal(): Promise<number> {
  const [row] = await db
    .select()
    .from(campaignCountersTable)
    .where(eq(campaignCountersTable.key, GOAL_KEY));
  return row?.count ?? DEFAULT_CAMPAIGN_GOAL;
}

router.get("/watan/bricks", async (_req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(campaignCountersTable)
    .where(eq(campaignCountersTable.key, BRICK_KEY));
  res.json({ count: row?.count ?? 0, goal: await getCampaignGoal() });
});

router.put(
  "/watan/goal",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = UpdateCampaignGoalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid goal" });
      return;
    }
    const [row] = await db
      .insert(campaignCountersTable)
      .values({ key: GOAL_KEY, count: parsed.data.goal })
      .onConflictDoUpdate({
        target: campaignCountersTable.key,
        set: { count: parsed.data.goal },
      })
      .returning();
    res.json({ goal: row!.count });
  },
);

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

// --- Dynamic OG share image with live brick counter ---

const OG_CACHE_TTL_MS = 60 * 1000;
let ogCache: { count: number; png: Buffer; at: number } | null = null;

function findFont(file: string): string | null {
  const candidates = [
    path.join(process.cwd(), "assets/fonts", file),
    path.join(process.cwd(), "artifacts/api-server/assets/fonts", file),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildOgSvg(count: number, goal: number): string {
  // Tajawal lacks glyphs for the Arabic thousands separator (U+066C),
  // so format with Latin digits + comma, which render cleanly.
  const arNum = new Intl.NumberFormat("en-US").format(count);
  const arGoal = new Intl.NumberFormat("en-US").format(goal);
  const percent = Math.min(100, (count / goal) * 100);
  const barWidth = Math.max(8, Math.round((1000 * percent) / 100));
  const barX = 100 + (1000 - barWidth); // fill from the right (RTL)

  // Decorative brick rows at the bottom
  let bricks = "";
  const brickColors = ["#00B140", "#043316", "#0D2B6B", "#1e3a8a"];
  for (let row = 0; row < 2; row++) {
    const y = 560 + row * 34;
    const offset = row % 2 === 0 ? 0 : 32;
    for (let i = 0; i < 20; i++) {
      const x = -20 + offset + i * 64;
      const c = brickColors[(i + row) % brickColors.length];
      bricks += `<rect x="${x}" y="${y}" width="58" height="28" rx="4" fill="${c}" opacity="0.85"/>`;
    }
  }

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#030914"/>
      <stop offset="100%" stop-color="#08152e"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00B140"/>
      <stop offset="100%" stop-color="#25D366"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  ${bricks}
  <text x="600" y="120" text-anchor="middle" font-family="Tajawal" font-weight="700" font-size="56" fill="#F1F4FB">${escapeXml("أطفالنا يبنون وطننا")}</text>
  <text x="600" y="300" text-anchor="middle" font-family="Tajawal" font-weight="700" font-size="150" fill="#00B140">${escapeXml(arNum)}</text>
  <text x="600" y="370" text-anchor="middle" font-family="Tajawal" font-size="40" fill="#9db2d9">${escapeXml(`مكعّب وُضع حتى الآن من هدف ${arGoal}`)}</text>
  <rect x="100" y="430" width="1000" height="26" rx="13" fill="#0a1529" stroke="#1e3a8a" stroke-width="1"/>
  <rect x="${barX}" y="430" width="${barWidth}" height="26" rx="13" fill="url(#bar)"/>
  <text x="600" y="510" text-anchor="middle" font-family="Tajawal" font-size="34" fill="#F1F4FB">${escapeXml("انضمّ وضع مكعّبك قبل اليوم الوطني")}</text>
</svg>`;
}

router.get("/watan/og-image.png", async (_req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(campaignCountersTable)
      .where(eq(campaignCountersTable.key, BRICK_KEY));
    const count = row?.count ?? 0;

    if (
      ogCache &&
      ogCache.count === count &&
      Date.now() - ogCache.at < OG_CACHE_TTL_MS
    ) {
      res
        .type("png")
        .setHeader("Cache-Control", "public, max-age=60")
        .send(ogCache.png);
      return;
    }

    const fontFiles = [
      findFont("Tajawal-Regular.ttf"),
      findFont("Tajawal-Bold.ttf"),
    ].filter((p): p is string => p !== null);
    if (fontFiles.length === 0) {
      throw new Error("OG image fonts not found on disk");
    }

    const svg = buildOgSvg(count, CAMPAIGN_GOAL);
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: {
        fontFiles,
        defaultFontFamily: "Tajawal",
        loadSystemFonts: false,
      },
    });
    const png = Buffer.from(resvg.render().asPng());
    ogCache = { count, png, at: Date.now() };

    res.type("png").setHeader("Cache-Control", "public, max-age=60").send(png);
  } catch (err) {
    res.status(500).json({ message: "Failed to render share image" });
    throw err;
  }
});

router.get("/watan/stats", requireRole("admin"), async (_req, res): Promise<void> => {
  const [counterRow] = await db
    .select()
    .from(campaignCountersTable)
    .where(eq(campaignCountersTable.key, BRICK_KEY));
  const campaignGoal = await getCampaignGoal();

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
    Math.round(Math.min(100, (total / campaignGoal) * 100) * 10) / 10;

  res.json({
    total,
    goal: campaignGoal,
    remaining: Math.max(0, campaignGoal - total),
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
