import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  db,
  childrenTable,
  subjectsTable,
  unitsTable,
  lessonsTable,
  exercisesTable,
  completionsTable,
} from "@workspace/db";
import { CompleteLessonBody } from "@workspace/api-zod";
import { getSession, requireAuth } from "../lib/auth";
import { serializeChild } from "../lib/serializers";

const router: IRouter = Router();

router.get("/lessons/:id", async (req, res): Promise<void> => {
  const raw = req.params["id"];
  const id = parseInt(Array.isArray(raw) ? raw[0]! : (raw as string), 10);
  const [lesson] = await db
    .select()
    .from(lessonsTable)
    .where(eq(lessonsTable.id, id));
  if (!lesson) {
    res.status(404).json({ message: "Lesson not found" });
    return;
  }
  const session = await getSession(req);
  // Free samples are public; everything else needs a session
  if (!lesson.isFreeSample && !session) {
    res.status(404).json({ message: "Lesson not found" });
    return;
  }
  const exercises = await db
    .select()
    .from(exercisesTable)
    .where(eq(exercisesTable.lessonId, id))
    .orderBy(asc(exercisesTable.position), asc(exercisesTable.id));
  const [unit] = await db
    .select()
    .from(unitsTable)
    .where(eq(unitsTable.id, lesson.unitId));
  const [subject] = unit
    ? await db
        .select()
        .from(subjectsTable)
        .where(eq(subjectsTable.id, unit.subjectId))
    : [undefined];
  res.json({
    ...lesson,
    subjectId: subject?.id ?? null,
    subjectNameAr: subject?.nameAr ?? null,
    unitTitleAr: unit?.titleAr ?? null,
    exercises,
  });
});

const XP_PER_LESSON = 50;
const BADGE_RULES: Array<{ key: string; test: (ctx: { total: number; streak: number; perfect: boolean }) => boolean }> = [
  { key: "first_lesson", test: (c) => c.total >= 1 },
  { key: "five_lessons", test: (c) => c.total >= 5 },
  { key: "ten_lessons", test: (c) => c.total >= 10 },
  { key: "streak_3", test: (c) => c.streak >= 3 },
  { key: "streak_7", test: (c) => c.streak >= 7 },
  { key: "perfect_score", test: (c) => c.perfect },
];

router.post(
  "/lessons/:id/complete",
  requireAuth,
  async (req, res): Promise<void> => {
    const child = req.auth!.child;
    if (!child) {
      res.status(401).json({ message: "No active child session" });
      return;
    }
    const raw = req.params["id"];
    const lessonId = parseInt(
      Array.isArray(raw) ? raw[0]! : (raw as string),
      10,
    );
    const parsed = CompleteLessonBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid completion" });
      return;
    }
    const answers = parsed.data.answers;
    const score =
      answers.length === 0
        ? 100
        : Math.round(
            (answers.filter((a) => a.correct).length / answers.length) * 100,
          );

    await db.insert(completionsTable).values({
      childId: child.id,
      lessonId,
      score,
      timeSpentSeconds: parsed.data.timeSpentSeconds,
    });

    // Streak logic
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    let streak = child.streak;
    if (child.lastActiveDate === today) {
      // already counted today
    } else if (child.lastActiveDate === yesterday) {
      streak += 1;
    } else {
      streak = 1;
    }

    const [{ count: totalCompleted }] = await db
      .select({ count: sql<number>`count(distinct ${completionsTable.lessonId})::int` })
      .from(completionsTable)
      .where(eq(completionsTable.childId, child.id));

    const ctx = {
      total: totalCompleted ?? 0,
      streak,
      perfect: score === 100,
    };
    const newBadges = BADGE_RULES.filter(
      (b) => b.test(ctx) && !child.badges.includes(b.key),
    ).map((b) => b.key);

    const totalXp = child.xp + XP_PER_LESSON;
    const [updated] = await db
      .update(childrenTable)
      .set({
        xp: totalXp,
        streak,
        lastActiveDate: today,
        badges: [...child.badges, ...newBadges],
      })
      .where(eq(childrenTable.id, child.id))
      .returning();

    res.json({
      xpEarned: XP_PER_LESSON,
      totalXp: updated!.xp,
      streak: updated!.streak,
      newBadges,
      score,
    });
  },
);

router.get("/child/home", requireAuth, async (req, res): Promise<void> => {
  const child = req.auth!.child;
  if (!child) {
    res.status(401).json({ message: "No active child session" });
    return;
  }

  // Today usage
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayCompletions = await db
    .select()
    .from(completionsTable)
    .where(
      and(
        eq(completionsTable.childId, child.id),
        gte(completionsTable.createdAt, startOfDay),
      ),
    );
  const todayMinutes = Math.round(
    todayCompletions.reduce((s, c) => s + c.timeSpentSeconds, 0) / 60,
  );

  // Continue lesson: next uncompleted published lesson in the child's band
  const units = await db
    .select()
    .from(unitsTable)
    .where(and(eq(unitsTable.band, child.band), eq(unitsTable.status, "published")))
    .orderBy(asc(unitsTable.position), asc(unitsTable.id));
  const unitIds = units.map((u) => u.id);
  const lessons = unitIds.length
    ? await db
        .select()
        .from(lessonsTable)
        .where(
          and(
            inArray(lessonsTable.unitId, unitIds),
            eq(lessonsTable.status, "published"),
          ),
        )
        .orderBy(asc(lessonsTable.position), asc(lessonsTable.id))
    : [];
  const done = new Set(
    (
      await db
        .select({ lessonId: completionsTable.lessonId })
        .from(completionsTable)
        .where(eq(completionsTable.childId, child.id))
    ).map((r) => r.lessonId),
  );
  const unitOrder = new Map(units.map((u, i) => [u.id, i]));
  const next = [...lessons].sort(
    (a, b) =>
      (unitOrder.get(a.unitId)! - unitOrder.get(b.unitId)!) ||
      a.position - b.position,
  ).find((l) => !done.has(l.id));

  let continueLesson = null;
  if (next) {
    const unit = units.find((u) => u.id === next.unitId);
    const [subject] = await db
      .select()
      .from(subjectsTable)
      .where(eq(subjectsTable.id, unit!.subjectId));
    continueLesson = {
      lessonId: next.id,
      titleAr: next.titleAr,
      titleEn: next.titleEn,
      subjectNameAr: subject?.nameAr ?? "",
      subjectColor: subject?.color ?? "#888888",
      subjectIcon: subject?.icon ?? "book",
    };
  }

  // Subjects with progress in the child's band
  const subjects = await db.select().from(subjectsTable).orderBy(subjectsTable.id);
  const subjectCards = subjects
    .map((s) => {
      const su = units.filter((u) => u.subjectId === s.id);
      const suIds = new Set(su.map((u) => u.id));
      const sl = lessons.filter((l) => suIds.has(l.unitId));
      const completed = sl.filter((l) => done.has(l.id)).length;
      return {
        id: s.id,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        slug: s.slug,
        icon: s.icon,
        color: s.color,
        bands: [child.band],
        unitCount: su.length,
        lessonCount: sl.length,
        progressPercent:
          sl.length > 0 ? Math.round((completed / sl.length) * 100) : 0,
      };
    })
    .filter((s) => (s.unitCount ?? 0) > 0);

  res.json({
    child: serializeChild(child),
    continueLesson,
    subjects: subjectCards,
    todayMinutes,
    dailyLimitReached:
      child.dailyLimitMinutes != null && todayMinutes >= child.dailyLimitMinutes,
  });
});

export default router;
