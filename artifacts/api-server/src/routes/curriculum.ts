import { Router, type IRouter } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  subjectsTable,
  unitsTable,
  lessonsTable,
  exercisesTable,
  completionsTable,
} from "@workspace/db";
import { CreateSubjectBody } from "@workspace/api-zod";
import { getSession, requireRole } from "../lib/auth";

const router: IRouter = Router();

const BANDS = ["explorers", "builders", "achievers", "graduates"] as const;
const BAND_META: Record<
  string,
  { nameAr: string; nameEn: string; ageRange: string; descriptionAr: string }
> = {
  explorers: {
    nameAr: "المستكشفون",
    nameEn: "Explorers",
    ageRange: "4–7",
    descriptionAr:
      "تعلّم باللعب: دروس قصيرة مليئة بالألوان والأصوات لصغار المستكشفين.",
  },
  builders: {
    nameAr: "البنّاؤون",
    nameEn: "Builders",
    ageRange: "8–11",
    descriptionAr:
      "شارات ونقاط وتحدّيات يومية تجعل التعلم مغامرة ممتعة.",
  },
  achievers: {
    nameAr: "المنجزون",
    nameEn: "Achievers",
    ageRange: "12–15",
    descriptionAr:
      "مسارات منظمة مع نسب إتقان واضحة لبناء أساس أكاديمي قوي.",
  },
  graduates: {
    nameAr: "الخريجون",
    nameEn: "Graduates",
    ageRange: "16–18",
    descriptionAr:
      "تحضير جاد للاختبارات مع تحليلات أداء واختبارات تدريبية.",
  },
};

async function subjectSummaries(band?: string, childId?: number) {
  const subjects = await db
    .select()
    .from(subjectsTable)
    .orderBy(subjectsTable.id);
  const units = await db.select().from(unitsTable);
  const lessons = await db
    .select()
    .from(lessonsTable)
    .where(eq(lessonsTable.status, "published"));
  const completedIds = childId
    ? new Set(
        (
          await db
            .select({ lessonId: completionsTable.lessonId })
            .from(completionsTable)
            .where(eq(completionsTable.childId, childId))
        ).map((r) => r.lessonId),
      )
    : null;

  return subjects
    .map((s) => {
      const subjectUnits = units.filter(
        (u) =>
          u.subjectId === s.id &&
          u.status === "published" &&
          (!band || u.band === band),
      );
      const unitIds = new Set(subjectUnits.map((u) => u.id));
      const subjectLessons = lessons.filter((l) => unitIds.has(l.unitId));
      const bands = [
        ...new Set(
          units
            .filter((u) => u.subjectId === s.id && u.status === "published")
            .map((u) => u.band),
        ),
      ] as (typeof BANDS)[number][];
      const completed = completedIds
        ? subjectLessons.filter((l) => completedIds.has(l.id)).length
        : null;
      return {
        id: s.id,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        slug: s.slug,
        icon: s.icon,
        color: s.color,
        bands,
        unitCount: subjectUnits.length,
        lessonCount: subjectLessons.length,
        progressPercent:
          completed !== null && subjectLessons.length > 0
            ? Math.round((completed / subjectLessons.length) * 100)
            : null,
      };
    })
    .filter((s) => !band || s.unitCount > 0);
}

router.get("/subjects", async (req, res): Promise<void> => {
  const session = await getSession(req);
  const band =
    typeof req.query["band"] === "string"
      ? (req.query["band"] as string)
      : session?.child
        ? session.child.band
        : undefined;
  res.json(await subjectSummaries(band, session?.child?.id));
});

router.post(
  "/subjects",
  requireRole("teacher", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateSubjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid subject" });
      return;
    }
    const [subject] = await db
      .insert(subjectsTable)
      .values(parsed.data)
      .returning();
    res.status(201).json({ ...subject!, bands: [], unitCount: 0, lessonCount: 0, progressPercent: null });
  },
);

router.get("/subjects/:id", async (req, res): Promise<void> => {
  const raw = req.params["id"];
  const id = parseInt(Array.isArray(raw) ? raw[0]! : (raw as string), 10);
  const session = await getSession(req);
  const isStaff =
    session && ["teacher", "admin"].includes(session.user.role);
  const band = session?.child ? session.child.band : undefined;

  const [subject] = await db
    .select()
    .from(subjectsTable)
    .where(eq(subjectsTable.id, id));
  if (!subject) {
    res.status(404).json({ message: "Subject not found" });
    return;
  }
  const unitFilters = [eq(unitsTable.subjectId, id)];
  if (!isStaff) unitFilters.push(eq(unitsTable.status, "published"));
  if (band) unitFilters.push(eq(unitsTable.band, band));
  const units = await db
    .select()
    .from(unitsTable)
    .where(and(...unitFilters))
    .orderBy(asc(unitsTable.position), asc(unitsTable.id));
  const unitIds = units.map((u) => u.id);
  const lessons = unitIds.length
    ? await db
        .select()
        .from(lessonsTable)
        .where(inArray(lessonsTable.unitId, unitIds))
        .orderBy(asc(lessonsTable.position), asc(lessonsTable.id))
    : [];
  const completions = session?.child
    ? await db
        .select()
        .from(completionsTable)
        .where(eq(completionsTable.childId, session.child.id))
    : [];
  const completionByLesson = new Map(
    completions.map((c) => [c.lessonId, c.score]),
  );

  res.json({
    id: subject.id,
    nameAr: subject.nameAr,
    nameEn: subject.nameEn,
    slug: subject.slug,
    icon: subject.icon,
    color: subject.color,
    bands: [...new Set(units.map((u) => u.band))],
    units: units.map((u) => ({
      ...u,
      lessons: lessons
        .filter((l) => l.unitId === u.id && (isStaff || l.status === "published"))
        .map((l) => ({
          id: l.id,
          unitId: l.unitId,
          titleAr: l.titleAr,
          titleEn: l.titleEn,
          durationMinutes: l.durationMinutes,
          position: l.position,
          status: l.status,
          isFreeSample: l.isFreeSample,
          completed: session?.child
            ? completionByLesson.has(l.id)
            : null,
          score: completionByLesson.get(l.id) ?? null,
        })),
    })),
  });
});

router.get("/curriculum/outline", async (_req, res): Promise<void> => {
  const subjects = await db.select().from(subjectsTable);
  const units = await db
    .select()
    .from(unitsTable)
    .where(eq(unitsTable.status, "published"))
    .orderBy(asc(unitsTable.position));
  const lessons = await db
    .select()
    .from(lessonsTable)
    .where(eq(lessonsTable.status, "published"))
    .orderBy(asc(lessonsTable.position));

  const outline = BANDS.map((b) => {
    const meta = BAND_META[b]!;
    const bandUnits = units.filter((u) => u.band === b);
    const subjectEntries = subjects
      .map((s) => {
        const su = bandUnits.filter((u) => u.subjectId === s.id);
        if (su.length === 0) return null;
        const unitIds = new Set(su.map((u) => u.id));
        const samples = lessons
          .filter((l) => unitIds.has(l.unitId) && l.isFreeSample)
          .slice(0, 3)
          .map((l) => ({
            id: l.id,
            unitId: l.unitId,
            titleAr: l.titleAr,
            titleEn: l.titleEn,
            durationMinutes: l.durationMinutes,
            position: l.position,
            status: l.status,
            isFreeSample: l.isFreeSample,
            completed: null,
            score: null,
          }));
        return {
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          icon: s.icon,
          color: s.color,
          unitTitlesAr: su.map((u) => u.titleAr),
          sampleLessons: samples,
        };
      })
      .filter((s) => s !== null);
    return {
      band: b,
      nameAr: meta.nameAr,
      nameEn: meta.nameEn,
      ageRange: meta.ageRange,
      descriptionAr: meta.descriptionAr,
      subjects: subjectEntries,
    };
  });
  res.json(outline);
});

export default router;
