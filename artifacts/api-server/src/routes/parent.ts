import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  childrenTable,
  subjectsTable,
  unitsTable,
  lessonsTable,
  completionsTable,
  dataDeletionRequestsTable,
} from "@workspace/db";
import { RequestDataDeletionBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { serializeChild } from "../lib/serializers";

const router: IRouter = Router();

function weekAgo(): Date {
  return new Date(Date.now() - 7 * 86400000);
}

router.get(
  "/parent/overview",
  requireAuth,
  async (req, res): Promise<void> => {
    const children = await db
      .select()
      .from(childrenTable)
      .where(eq(childrenTable.parentId, req.auth!.user.id))
      .orderBy(childrenTable.id);

    const childIds = children.map((c) => c.id);
    const completions = childIds.length
      ? await db
          .select()
          .from(completionsTable)
          .where(inArray(completionsTable.childId, childIds))
      : [];
    const lessons = await db.select().from(lessonsTable);
    const units = await db.select().from(unitsTable);
    const subjects = await db.select().from(subjectsTable);
    const subjectByUnit = new Map(
      units.map((u) => [
        u.id,
        subjects.find((s) => s.id === u.subjectId)?.nameAr ?? "",
      ]),
    );
    const unitByLesson = new Map(lessons.map((l) => [l.id, l.unitId]));

    const cards = children.map((child) => {
      const all = completions.filter((c) => c.childId === child.id);
      const week = all.filter((c) => c.createdAt >= weekAgo());
      const subjectNames = [
        ...new Set(
          all
            .map((c) => subjectByUnit.get(unitByLesson.get(c.lessonId) ?? -1))
            .filter((s): s is string => !!s),
        ),
      ];
      return {
        child: serializeChild(child),
        minutesThisWeek: Math.round(
          week.reduce((s, c) => s + c.timeSpentSeconds, 0) / 60,
        ),
        lessonsCompletedThisWeek: week.length,
        lessonsCompletedTotal: new Set(all.map((c) => c.lessonId)).size,
        subjectsCovered: subjectNames,
        averageScore:
          all.length > 0
            ? Math.round(all.reduce((s, c) => s + c.score, 0) / all.length)
            : null,
      };
    });
    res.json({ children: cards });
  },
);

router.get(
  "/parent/children/:id/report",
  requireAuth,
  async (req, res): Promise<void> => {
    const raw = req.params["id"];
    const id = parseInt(Array.isArray(raw) ? raw[0]! : (raw as string), 10);
    const [child] = await db
      .select()
      .from(childrenTable)
      .where(
        and(
          eq(childrenTable.id, id),
          eq(childrenTable.parentId, req.auth!.user.id),
        ),
      );
    if (!child) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const completions = await db
      .select()
      .from(completionsTable)
      .where(eq(completionsTable.childId, id))
      .orderBy(desc(completionsTable.createdAt));
    const lessons = await db.select().from(lessonsTable);
    const units = await db.select().from(unitsTable);
    const subjects = await db.select().from(subjectsTable);
    const lessonById = new Map(lessons.map((l) => [l.id, l]));
    const unitById = new Map(units.map((u) => [u.id, u]));

    // Topic (= unit) aggregates
    const byUnit = new Map<number, { scores: number[] }>();
    for (const c of completions) {
      const lesson = lessonById.get(c.lessonId);
      if (!lesson) continue;
      const entry = byUnit.get(lesson.unitId) ?? { scores: [] };
      entry.scores.push(c.score);
      byUnit.set(lesson.unitId, entry);
    }
    const topicScores = [...byUnit.entries()]
      .map(([unitId, { scores }]) => {
        const unit = unitById.get(unitId);
        if (!unit) return null;
        const subject = subjects.find((s) => s.id === unit.subjectId);
        return {
          topicAr: unit.titleAr,
          topicEn: unit.titleEn,
          subjectNameAr: subject?.nameAr ?? "",
          averageScore: Math.round(
            scores.reduce((a, b) => a + b, 0) / scores.length,
          ),
          attempts: scores.length,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
    const strengths = topicScores
      .filter((t) => t.averageScore >= 80)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 5);
    const struggles = topicScores
      .filter((t) => t.averageScore < 70)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 5);

    // Last 7 days activity
    const weekActivity = [...Array(7)].map((_, i) => {
      const day = new Date(Date.now() - (6 - i) * 86400000);
      const key = day.toISOString().slice(0, 10);
      const dayCompletions = completions.filter(
        (c) => c.createdAt.toISOString().slice(0, 10) === key,
      );
      return {
        date: key,
        minutes: Math.round(
          dayCompletions.reduce((s, c) => s + c.timeSpentSeconds, 0) / 60,
        ),
        lessonsCompleted: dayCompletions.length,
      };
    });

    const recentLessons = completions.slice(0, 6).map((c) => {
      const l = lessonById.get(c.lessonId);
      return {
        id: c.lessonId,
        unitId: l?.unitId ?? 0,
        titleAr: l?.titleAr ?? "",
        titleEn: l?.titleEn ?? "",
        durationMinutes: l?.durationMinutes ?? 0,
        position: l?.position ?? 0,
        status: l?.status ?? "published",
        isFreeSample: l?.isFreeSample ?? false,
        completed: true,
        score: c.score,
      };
    });

    res.json({
      child: serializeChild(child),
      strengths,
      struggles,
      weekActivity,
      recentLessons,
    });
  },
);

router.post(
  "/parent/data-deletion",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = RequestDataDeletionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request" });
      return;
    }
    await db.insert(dataDeletionRequestsTable).values({
      userId: req.auth!.user.id,
      reason: parsed.data.reason,
    });
    res.status(201).json({
      message:
        "تم استلام طلب حذف البيانات وسيتم التواصل معك خلال 30 يوماً",
    });
  },
);

export default router;
