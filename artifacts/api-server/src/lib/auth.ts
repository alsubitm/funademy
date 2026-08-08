import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db, usersTable, childrenTable, type User, type Child } from "@workspace/db";
import { eq } from "drizzle-orm";

const SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";
const COOKIE_NAME = "manara_session";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  userId: number;
  childId?: number;
  exp: number;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function signToken(payload: Omit<SessionPayload, "exp">): string {
  const full: SessionPayload = { ...payload, exp: Date.now() + MAX_AGE_MS };
  const body = b64url(Buffer.from(JSON.stringify(full)));
  const sig = b64url(
    crypto.createHmac("sha256", SECRET).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function verifyToken(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(
    crypto.createHmac("sha256", SECRET).update(body).digest(),
  );
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as SessionPayload;
    if (typeof payload.userId !== "number" || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(candidate));
}

/** PINs are hashed with the same scrypt scheme as passwords. */
export function hashPin(pin: string): string {
  return hashPassword(pin);
}

/**
 * Verifies a PIN against its stored value.
 * Supports legacy plaintext rows (no "salt:hash" scrypt format) via a
 * constant-time comparison; callers should re-hash on successful legacy match.
 * Returns { ok, legacy } so callers can lazily upgrade plaintext PINs.
 */
export function verifyPin(
  pin: string,
  stored: string,
): { ok: boolean; legacy: boolean } {
  const [salt, hash] = stored.split(":");
  if (salt && hash && hash.length === 128) {
    return { ok: verifyPassword(pin, stored), legacy: false };
  }
  // Legacy plaintext PIN: constant-time comparison.
  const a = crypto.createHash("sha256").update(pin).digest();
  const b = crypto.createHash("sha256").update(stored).digest();
  return { ok: crypto.timingSafeEqual(a, b), legacy: true };
}

export function setSessionCookie(
  res: Response,
  payload: Omit<SessionPayload, "exp">,
): void {
  res.cookie(COOKIE_NAME, signToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export interface AuthContext {
  user: User;
  child: Child | null;
}

export async function getSession(req: Request): Promise<AuthContext | null> {
  const token = (req.cookies as Record<string, string> | undefined)?.[
    COOKIE_NAME
  ];
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId));
  if (!user) return null;
  let child: Child | null = null;
  if (payload.childId) {
    const [c] = await db
      .select()
      .from(childrenTable)
      .where(eq(childrenTable.id, payload.childId));
    if (c && c.parentId === user.id) child = c;
  }
  return { user, child };
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ message: "Not logged in" });
    return;
  }
  req.auth = session;
  next();
}

export function requireRole(...roles: string[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const session = await getSession(req);
    if (!session) {
      res.status(401).json({ message: "Not logged in" });
      return;
    }
    if (!roles.includes(session.user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    req.auth = session;
    next();
  };
}

export function bandForBirth(birthYear: number, birthMonth: number): string {
  const now = new Date();
  let age = now.getFullYear() - birthYear;
  if (now.getMonth() + 1 < birthMonth) age -= 1;
  if (age <= 7) return "explorers";
  if (age <= 11) return "builders";
  if (age <= 15) return "achievers";
  return "graduates";
}
