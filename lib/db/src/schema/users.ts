import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // scrypt "salt:hash" of the 4-digit parent PIN (legacy rows may still be
  // plaintext until lazily upgraded on first successful verification).
  pin: text("pin").notNull().default("0000"),
  role: text("role").notNull().default("parent"), // parent | teacher | admin
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationToken: text("verification_token"), // sha256 hash of the emailed token
  verificationTokenExpires: timestamp("verification_token_expires", {
    withTimezone: true,
  }),
  lastDigestAt: timestamp("last_digest_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
