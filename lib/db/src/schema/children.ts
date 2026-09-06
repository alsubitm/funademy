import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const childrenTable = pgTable("children", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  avatar: text("avatar").notNull(),
  band: text("band").notNull(), // explorers | builders | achievers | graduates
  birthYear: integer("birth_year").notNull(),
  birthMonth: integer("birth_month").notNull(),
  pin: text("pin").notNull(),
  xp: integer("xp").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  lastActiveDate: date("last_active_date", { mode: "string" }),
  badges: text("badges").array().notNull().default([]),
  dailyLimitMinutes: integer("daily_limit_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertChildSchema = createInsertSchema(childrenTable).omit({
  id: true,
  createdAt: true,
});
export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof childrenTable.$inferSelect;
