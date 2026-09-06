import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, childrenTable, subscriptionsTable } from "@workspace/db";
import {
  CreateChildBody,
  UpdateChildBody,
  SelectChildBody,
} from "@workspace/api-zod";
import { requireAuth, setSessionCookie, bandForBirth } from "../lib/auth";
import { serializeChild, serializeSessionUser } from "../lib/serializers";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0]! : raw, 10);
}

router.get("/children", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(childrenTable)
    .where(eq(childrenTable.parentId, req.auth!.user.id))
    .orderBy(childrenTable.id);
  res.json(rows.map(serializeChild));
});

router.post("/children", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateChildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }
  const d = parsed.data;
  const [child] = await db
    .insert(childrenTable)
    .values({
      parentId: req.auth!.user.id,
      name: d.name,
      avatar: d.avatar,
      band: bandForBirth(d.birthYear, d.birthMonth),
      birthYear: d.birthYear,
      birthMonth: d.birthMonth,
      pin: d.pin,
      dailyLimitMinutes: d.dailyLimitMinutes ?? null,
    })
    .returning();
  res.status(201).json(serializeChild(child!));
});

router.patch("/children/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params["id"] as string);
  const parsed = UpdateChildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }
  const [child] = await db
    .update(childrenTable)
    .set(parsed.data)
    .where(
      and(
        eq(childrenTable.id, id),
        eq(childrenTable.parentId, req.auth!.user.id),
      ),
    )
    .returning();
  if (!child) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }
  res.json(serializeChild(child));
});

router.delete(
  "/children/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = parseId(req.params["id"] as string);
    const [child] = await db
      .delete(childrenTable)
      .where(
        and(
          eq(childrenTable.id, id),
          eq(childrenTable.parentId, req.auth!.user.id),
        ),
      )
      .returning();
    if (!child) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }
    res.json({ message: "تم حذف الملف" });
  },
);

router.post(
  "/children/:id/select",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = parseId(req.params["id"] as string);
    const parsed = SelectChildBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
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
    if (child.pin !== parsed.data.pin) {
      res.status(401).json({ message: "الرقم السري غير صحيح" });
      return;
    }
    setSessionCookie(res, { userId: req.auth!.user.id, childId: child.id });
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, req.auth!.user.id));
    res.json(serializeSessionUser(req.auth!.user, child, sub ?? null));
  },
);

export default router;
