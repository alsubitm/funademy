import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subjectsTable = pgTable("subjects", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
});

export const unitsTable = pgTable("units", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjectsTable.id, { onDelete: "cascade" }),
  band: text("band").notNull(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  position: integer("position").notNull().default(0),
  status: text("status").notNull().default("published"), // draft | published
});

export const lessonsTable = pgTable("lessons", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id")
    .notNull()
    .references(() => unitsTable.id, { onDelete: "cascade" }),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionAr: text("description_ar").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  videoUrl: text("video_url").notNull().default(""),
  videoType: text("video_type").notNull().default("youtube"), // youtube | vimeo | mp4
  durationMinutes: integer("duration_minutes").notNull().default(8),
  position: integer("position").notNull().default(0),
  status: text("status").notNull().default("published"),
  isFreeSample: boolean("is_free_sample").notNull().default(false),
});

export const exercisesTable = pgTable("exercises", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lessonsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // multiple_choice | matching | fill_blank | picture_select
  promptAr: text("prompt_ar").notNull(),
  promptEn: text("prompt_en").notNull(),
  options: text("options").array().notNull().default([]),
  correctAnswer: text("correct_answer").notNull(),
  position: integer("position").notNull().default(0),
});

export const insertSubjectSchema = createInsertSchema(subjectsTable).omit({
  id: true,
});
export const insertUnitSchema = createInsertSchema(unitsTable).omit({
  id: true,
});
export const insertLessonSchema = createInsertSchema(lessonsTable).omit({
  id: true,
});
export const insertExerciseSchema = createInsertSchema(exercisesTable).omit({
  id: true,
});
export type Subject = typeof subjectsTable.$inferSelect;
export type Unit = typeof unitsTable.$inferSelect;
export type Lesson = typeof lessonsTable.$inferSelect;
export type Exercise = typeof exercisesTable.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
