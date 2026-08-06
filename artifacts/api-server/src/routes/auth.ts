import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import crypto from "node:crypto";
import {
  RegisterBody,
  LoginBody,
  VerifyParentGateBody,
  VerifyEmailBody,
} from "@workspace/api-zod";
import { activeEmailProvider } from "../lib/email";
import {
  getSession,
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
} from "../lib/auth";
import { serializeSessionUser } from "../lib/serializers";

const router: IRouter = Router();

async function subscriptionFor(userId: number) {
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));
  return sub ?? null;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }
  const { name, email, password, pin } = parsed.data;
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(400).json({ message: "هذا البريد الإلكتروني مسجّل بالفعل" });
    return;
  }
  const verificationToken = crypto.randomBytes(24).toString("base64url");
  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      pin,
      role: "parent",
      verificationToken,
    })
    .returning();
  await sendVerificationEmail(user!.email, user!.name, verificationToken, req);
  setSessionCookie(res, { userId: user!.id });
  res.status(201).json(serializeSessionUser(user!, null, null));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase()));
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    res
      .status(401)
      .json({ message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    return;
  }
  setSessionCookie(res, { userId: user.id });
  res.json(serializeSessionUser(user, null, await subscriptionFor(user.id)));
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  clearSessionCookie(res);
  res.json({ message: "تم تسجيل الخروج" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ message: "Not logged in" });
    return;
  }
  res.json(
    serializeSessionUser(
      session.user,
      session.child,
      await subscriptionFor(session.user.id),
    ),
  );
});

router.post("/auth/parent-gate", async (req, res): Promise<void> => {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ message: "Not logged in" });
    return;
  }
  const parsed = VerifyParentGateBody.safeParse(req.body);
  if (!parsed.success || parsed.data.pin !== session.user.pin) {
    res.status(401).json({ message: "الرقم السري غير صحيح" });
    return;
  }
  setSessionCookie(res, { userId: session.user.id });
  res.json(
    serializeSessionUser(
      session.user,
      null,
      await subscriptionFor(session.user.id),
    ),
  );
});

async function sendVerificationEmail(
  to: string,
  name: string,
  token: string,
  req: { headers: Record<string, unknown> },
): Promise<string | null> {
  const origin =
    typeof req.headers["origin"] === "string"
      ? (req.headers["origin"] as string)
      : "";
  const url = `${origin}/verify-email?token=${token}`;
  const { devActionUrl } = await activeEmailProvider.send({
    to,
    subject: "تأكيد بريدك الإلكتروني — منارة",
    html: `<div dir="rtl"><p>مرحباً ${name}،</p><p>اضغط الرابط لتأكيد بريدك الإلكتروني:</p><p><a href="${url}">تأكيد البريد</a></p></div>`,
    actionUrl: url,
  });
  return devActionUrl;
}

router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const parsed = VerifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "رمز غير صالح" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.verificationToken, parsed.data.token));
  if (!user) {
    res.status(400).json({ message: "رمز التحقق غير صالح أو منتهي" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ emailVerified: true, verificationToken: null })
    .where(eq(usersTable.id, user.id))
    .returning();
  res.json(
    serializeSessionUser(updated!, null, await subscriptionFor(user.id)),
  );
});

router.post("/auth/resend-verification", async (req, res): Promise<void> => {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ message: "Not logged in" });
    return;
  }
  if (session.user.emailVerified) {
    res.json({ message: "البريد مؤكد بالفعل", devVerificationUrl: null });
    return;
  }
  let token = session.user.verificationToken;
  if (!token) {
    token = crypto.randomBytes(24).toString("base64url");
    await db
      .update(usersTable)
      .set({ verificationToken: token })
      .where(eq(usersTable.id, session.user.id));
  }
  const devUrl = await sendVerificationEmail(
    session.user.email,
    session.user.name,
    token,
    req,
  );
  res.json({
    message: "تم إرسال رابط التحقق إلى بريدك",
    devVerificationUrl: devUrl,
  });
});

export default router;
