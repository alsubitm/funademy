import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, subscriptionsTable, invoicesTable } from "@workspace/db";
import { StartSubscriptionBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { activeProvider, isValidCoupon } from "../lib/payments";

const router: IRouter = Router();

function serializeSubscription(sub: {
  status: string;
  plan: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  priceSar: number | null;
  couponCode: string | null;
} | null) {
  if (!sub) {
    return {
      status: "none",
      plan: "none",
      trialEndsAt: null,
      currentPeriodEnd: null,
      priceSar: null,
      couponCode: null,
    };
  }
  return {
    status: sub.status,
    plan: sub.plan,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    priceSar: sub.priceSar,
    couponCode: sub.couponCode,
  };
}

router.get("/subscription", requireAuth, async (req, res): Promise<void> => {
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, req.auth!.user.id));
  res.json(serializeSubscription(sub ?? null));
});

router.post("/subscription", requireAuth, async (req, res): Promise<void> => {
  const parsed = StartSubscriptionBody.safeParse(req.body);
  if (!parsed.success || !["monthly", "annual"].includes(parsed.data.plan)) {
    res.status(400).json({ message: "خطة غير صالحة" });
    return;
  }
  const plan = parsed.data.plan as "monthly" | "annual";
  const coupon = parsed.data.couponCode ?? null;
  if (coupon && !isValidCoupon(coupon)) {
    res.status(400).json({ message: "رمز الخصم غير صالح" });
    return;
  }

  const result = await activeProvider.startSubscription({
    userId: req.auth!.user.id,
    plan,
    couponCode: coupon,
    cardLast4: parsed.data.cardLast4 ?? null,
  });

  const trialEndsAt = new Date(Date.now() + result.trialDays * 86400000);
  const periodEnd = new Date(
    trialEndsAt.getTime() + (plan === "annual" ? 365 : 30) * 86400000,
  );

  const values = {
    userId: req.auth!.user.id,
    status: "trial",
    plan,
    trialEndsAt,
    currentPeriodEnd: periodEnd,
    priceSar: result.priceSar,
    couponCode: coupon,
    cardLast4: parsed.data.cardLast4 ?? null,
  };
  const [sub] = await db
    .insert(subscriptionsTable)
    .values(values)
    .onConflictDoUpdate({
      target: subscriptionsTable.userId,
      set: values,
    })
    .returning();

  await db.insert(invoicesTable).values({
    userId: req.auth!.user.id,
    amountSar: 0,
    status: "trial",
    description: `بداية التجربة المجانية — خطة ${plan === "annual" ? "سنوية" : "شهرية"} (${result.priceSar} ر.س بعد التجربة)`,
  });

  res.status(201).json(serializeSubscription(sub!));
});

router.post(
  "/subscription/cancel",
  requireAuth,
  async (req, res): Promise<void> => {
    await activeProvider.cancelSubscription(req.auth!.user.id);
    const [sub] = await db
      .update(subscriptionsTable)
      .set({ status: "cancelled" })
      .where(eq(subscriptionsTable.userId, req.auth!.user.id))
      .returning();
    res.json(serializeSubscription(sub ?? null));
  },
);

router.get(
  "/subscription/invoices",
  requireAuth,
  async (req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.userId, req.auth!.user.id))
      .orderBy(desc(invoicesTable.date));
    res.json(
      rows.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        amountSar: r.amountSar,
        status: r.status,
        description: r.description,
      })),
    );
  },
);

export default router;
