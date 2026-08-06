import {
  pgTable,
  serial,
  integer,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { lessonsTable } from "./curriculum";

export const completionsTable = pgTable("completions", {
  id: serial("id").primaryKey(),
  childId: integer("child_id")
    .notNull()
    .references(() => childrenTable.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lessonsTable.id, { onDelete: "cascade" }),
  score: real("score").notNull(), // 0-100
  timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCompletionSchema = createInsertSchema(
  completionsTable,
).omit({ id: true, createdAt: true });
export type InsertCompletion = z.infer<typeof insertCompletionSchema>;
export type Completion = typeof completionsTable.$inferSelect;
