import { Router, type IRouter } from "express";
import { asc, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  childrenTable,
  subscriptionsTable,
  unitsTable,
  lessonsTable,
  exercisesTable,
  completionsTable,
} from "@workspace/db";
import {
  CreateUnitBody,
  UpdateUnitBody,
  CreateLessonBody,
  UpdateLessonBody,
  UpdateAdminUserBody,
  ImportExercisesCsvBody,
} from "@workspace/api-zod";
import { requireRole } from "../lib/auth";

const router: IRouter = Router();
const staff = requireRole("teacher", "admin");

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0]! : raw, 10);
}

// ---- Units ----

router.post("/units", staff, async (req, res): Promise<void> => {
  const parsed = CreateUnitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid unit" });
    return;
  }
  const d = parsed.data;
  const [unit] = await db
    .insert(unitsTable)
    .values({
      subjectId: d.subjectId,
      band: d.band,
      titleAr: d.titleAr,
      titleEn: d.titleEn,
      position: d.position ?? 0,
      status: d.status ?? "draft",
    })
    .returning();
  res.status(201).json(unit!);
});

router.patch("/units/:id", staff, async (req, res): Promise<void> => {
  const parsed = UpdateUnitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid unit" });
    return;
  }
  const [unit] = await db
    .update(unitsTable)
    .set(parsed.data)
    .where(eq(unitsTable.id, parseId(req.params["id"] as string)))
    .returning();
  if (!unit) {
    res.status(404).json({ message: "Unit not found" });
    return;
  }
  res.json(unit);
});

router.delete("/units/:id", staff, async (req, res): Promise<void> => {
  const [unit] = await db
    .delete(unitsTable)
    .where(eq(unitsTable.id, parseId(req.params["id"] as string)))
    .returning();
  if (!unit) {
    res.status(404).json({ message: "Unit not found" });
    return;
  }
  res.json({ message: "Unit deleted" });
});

// ---- Lessons ----

async function lessonWithExercises(lessonId: number) {
  const [lesson] = await db
    .select()
    .from(lessonsTable)
    .where(eq(lessonsTable.id, lessonId));
  if (!lesson) return null;
  const exercises = await db
    .select()
    .from(exercisesTable)
    .where(eq(exercisesTable.lessonId, lessonId))
    .orderBy(asc(exercisesTable.position));
  return {
    ...lesson,
    subjectId: null,
    subjectNameAr: null,
    unitTitleAr: null,
    exercises,
  };
}

router.post("/lessons", staff, async (req, res): Promise<void> => {
  const parsed = CreateLessonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid lesson" });
    return;
  }
  const d = parsed.data;
  const [lesson] = await db
    .insert(lessonsTable)
    .values({
      unitId: d.unitId,
      titleAr: d.titleAr,
      titleEn: d.titleEn,
      descriptionAr: d.descriptionAr,
      descriptionEn: d.descriptionEn,
      videoUrl: d.videoUrl,
      videoType: d.videoType,
      durationMinutes: d.durationMinutes,
      isFreeSample: d.isFreeSample ?? false,
      status: d.status ?? "draft",
      position: d.position ?? 0,
    })
    .returning();
  if (d.exercises?.length) {
    await db.insert(exercisesTable).values(
      d.exercises.map((e, i) => ({
        lessonId: lesson!.id,
        type: e.type,
        promptAr: e.promptAr,
        promptEn: e.promptEn,
        options: e.options,
        correctAnswer: e.correctAnswer,
        position: e.position ?? i,
      })),
    );
  }
  res.status(201).json(await lessonWithExercises(lesson!.id));
});

router.patch("/lessons/:id", staff, async (req, res): Promise<void> => {
  const id = parseId(req.params["id"] as string);
  const parsed = UpdateLessonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid lesson" });
    return;
  }
  const { exercises, ...fields } = parsed.data;
  if (Object.keys(fields).length > 0) {
    const [lesson] = await db
      .update(lessonsTable)
      .set(fields)
      .where(eq(lessonsTable.id, id))
      .returning();
    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }
  }
  if (exercises) {
    await db.delete(exercisesTable).where(eq(exercisesTable.lessonId, id));
    if (exercises.length) {
      await db.insert(exercisesTable).values(
        exercises.map((e, i) => ({
          lessonId: id,
          type: e.type,
          promptAr: e.promptAr,
          promptEn: e.promptEn,
          options: e.options,
          correctAnswer: e.correctAnswer,
          position: e.position ?? i,
        })),
      );
    }
  }
  const result = await lessonWithExercises(id);
  if (!result) {
    res.status(404).json({ message: "Lesson not found" });
    return;
  }
  res.json(result);
});

router.delete("/lessons/:id", staff, async (req, res): Promise<void> => {
  const [lesson] = await db
    .delete(lessonsTable)
    .where(eq(lessonsTable.id, parseId(req.params["id"] as string)))
    .returning();
  if (!lesson) {
    res.status(404).json({ message: "Lesson not found" });
    return;
  }
  res.json({ message: "Lesson deleted" });
});

const EXERCISE_TYPES = new Set([
  "multiple_choice",
  "matching",
  "fill_blank",
  "picture_select",
]);

/** Minimal CSV line parser supporting double-quoted fields. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

router.post(
  "/lessons/:id/exercises/csv",
  staff,
  async (req, res): Promise<void> => {
    const lessonId = parseId(req.params["id"] as string);
    const parsed = ImportExercisesCsvBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid CSV payload" });
      return;
    }
    const [lesson] = await db
      .select()
      .from(lessonsTable)
      .where(eq(lessonsTable.id, lessonId));
    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    const lines = parsed.data.csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    // Skip a header row if present
    if (lines[0] && /^type\s*,/i.test(lines[0])) lines.shift();

    const errors: string[] = [];
    const rows: Array<{
      type: string;
      promptAr: string;
      promptEn: string;
      options: string[];
      correctAnswer: string;
    }> = [];
    lines.forEach((line, idx) => {
      const cells = parseCsvLine(line);
      const [type, promptAr, promptEn, options, correctAnswer] = cells;
      if (!type || !EXERCISE_TYPES.has(type)) {
        errors.push(`سطر ${idx + 1}: نوع تمرين غير معروف "${type ?? ""}"`);
        return;
      }
      if (!promptAr || !correctAnswer) {
        errors.push(`سطر ${idx + 1}: السؤال أو الإجابة الصحيحة مفقودة`);
        return;
      }
      const opts = options
        ? options.split("|").map((o) => o.trim()).filter(Boolean)
        : [];
      if (
        (type === "multiple_choice" || type === "picture_select") &&
        !opts.includes(correctAnswer)
      ) {
        errors.push(
          `سطر ${idx + 1}: الإجابة الصحيحة يجب أن تكون أحد الخيارات`,
        );
        return;
      }
      rows.push({
        type,
        promptAr,
        promptEn: promptEn ?? "",
        options: opts,
        correctAnswer,
      });
    });

    if (parsed.data.replace) {
      await db
        .delete(exercisesTable)
        .where(eq(exercisesTable.lessonId, lessonId));
    }
    if (rows.length > 0) {
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(${exercisesTable.position}), -1)::int` })
        .from(exercisesTable)
        .where(eq(exercisesTable.lessonId, lessonId));
      await db.insert(exercisesTable).values(
        rows.map((r, i) => ({
          lessonId,
          ...r,
          position: (max ?? -1) + 1 + i,
        })),
      );
    }
    res.json({
      imported: rows.length,
      skipped: errors.length,
      errors,
    });
  },
);

// ---- Analytics ----

router.get(
  "/admin/analytics",
  requireRole("admin", "teacher"),
  async (_req, res): Promise<void> => {
    const [{ count: totalParents }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, "parent"));
    const [{ count: totalChildren }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(childrenTable);
    const subs = await db.select().from(subscriptionsTable);
    const active = subs.filter((s) => s.status === "active");
    const trialing = subs.filter((s) => s.status === "trial");
    const cancelled = subs.filter((s) => s.status === "cancelled");
    const started = subs.length;
    const mrr = active.reduce(
      (sum, s) =>
        sum + (s.plan === "annual" ? (s.priceSar ?? 0) / 12 : (s.priceSar ?? 0)),
      0,
    );

    const dayAgo = new Date(Date.now() - 86400000);
    const [{ count: dailyActiveChildren }] = await db
      .select({
        count: sql<number>`count(distinct ${completionsTable.childId})::int`,
      })
      .from(completionsTable)
      .where(gte(completionsTable.createdAt, dayAgo));

    const engagement = await db
      .select({
        lessonId: completionsTable.lessonId,
        completions: sql<number>`count(*)::int`,
        averageScore: sql<number>`round(avg(${completionsTable.score}))::int`,
      })
      .from(completionsTable)
      .groupBy(completionsTable.lessonId)
      .orderBy(desc(sql`count(*)`))
      .limit(10);
    const lessons = await db.select().from(lessonsTable);
    const lessonById = new Map(lessons.map((l) => [l.id, l]));

    res.json({
      totalParents: totalParents ?? 0,
      totalChildren: totalChildren ?? 0,
      activeSubscriptions: active.length,
      trialingSubscriptions: trialing.length,
      trialConversionRate:
        started > 0 ? Math.round((active.length / started) * 100) : 0,
      churnRate:
        started > 0 ? Math.round((cancelled.length / started) * 100) : 0,
      mrrSar: Math.round(mrr * 100) / 100,
      dailyActiveChildren: dailyActiveChildren ?? 0,
      lessonEngagement: engagement.map((e) => ({
        lessonId: e.lessonId,
        titleAr: lessonById.get(e.lessonId)?.titleAr ?? "",
        completions: e.completions,
        averageScore: e.averageScore,
      })),
    });
  },
);

// ---- Users ----

router.get(
  "/admin/users",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const search =
      typeof req.query["search"] === "string"
        ? (req.query["search"] as string)
        : "";
    const users = await db
      .select()
      .from(usersTable)
      .where(
        search
          ? or(
              ilike(usersTable.name, `%${search}%`),
              ilike(usersTable.email, `%${search}%`),
            )
          : undefined,
      )
      .orderBy(desc(usersTable.createdAt));
    const children = await db.select().from(childrenTable);
    const subs = await db.select().from(subscriptionsTable);
    res.json(
      users.map((u) => {
        const sub = subs.find((s) => s.userId === u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role as "parent" | "teacher" | "admin",
          childCount: children.filter((c) => c.parentId === u.id).length,
          subscriptionStatus: sub?.status ?? "none",
          plan: sub?.plan ?? "none",
          createdAt: u.createdAt.toISOString(),
        };
      }),
    );
  },
);

router.patch(
  "/admin/users/:id",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseId(req.params["id"] as string);
    const parsed = UpdateAdminUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid update" });
      return;
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, id));
    if (parsed.data.extendTrialDays) {
      const base = sub?.trialEndsAt ?? new Date();
      const newEnd = new Date(
        Math.max(base.getTime(), Date.now()) +
          parsed.data.extendTrialDays * 86400000,
      );
      if (sub) {
        await db
          .update(subscriptionsTable)
          .set({ trialEndsAt: newEnd, status: "trial" })
          .where(eq(subscriptionsTable.userId, id));
      } else {
        await db.insert(subscriptionsTable).values({
          userId: id,
          status: "trial",
          plan: "monthly",
          trialEndsAt: newEnd,
          priceSar: 49,
        });
      }
    }
    if (parsed.data.subscriptionStatus && sub) {
      await db
        .update(subscriptionsTable)
        .set({ status: parsed.data.subscriptionStatus })
        .where(eq(subscriptionsTable.userId, id));
    }
    const [finalSub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, id));
    const children = await db
      .select()
      .from(childrenTable)
      .where(eq(childrenTable.parentId, id));
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as "parent" | "teacher" | "admin",
      childCount: children.length,
      subscriptionStatus: finalSub?.status ?? "none",
      plan: finalSub?.plan ?? "none",
      createdAt: user.createdAt.toISOString(),
    });
  },
);

export default router;
