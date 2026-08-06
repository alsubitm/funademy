import type { Child, User, Subscription } from "@workspace/db";

export function serializeChild(c: Child) {
  return {
    id: c.id,
    name: c.name,
    avatar: c.avatar,
    band: c.band as "explorers" | "builders" | "achievers" | "graduates",
    birthYear: c.birthYear,
    birthMonth: c.birthMonth,
    xp: c.xp,
    streak: c.streak,
    badges: c.badges,
    dailyLimitMinutes: c.dailyLimitMinutes ?? null,
  };
}

export function serializeSessionUser(
  user: User,
  child: Child | null,
  subscription?: Subscription | null,
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as "parent" | "teacher" | "admin",
    emailVerified: user.emailVerified,
    activeChild: child ? serializeChild(child) : null,
    subscriptionStatus: subscription?.status ?? "none",
  };
}
