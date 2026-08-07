import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  titleAr: text("title_ar").notNull(),
  excerptAr: text("excerpt_ar").notNull(),
  contentAr: text("content_ar").notNull(),
  coverEmoji: text("cover_emoji").notNull().default("📚"),
  publishedAt: timestamp("published_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const campaignCountersTable = pgTable("campaign_counters", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
});

export const campaignBrickEventsTable = pgTable(
  "campaign_brick_events",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    amount: integer("amount").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("campaign_brick_events_key_created_at_idx").on(t.key, t.createdAt)],
);

export const dataDeletionRequestsTable = pgTable("data_deletion_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPostsTable).omit({
  id: true,
  publishedAt: true,
});
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPostsTable.$inferSelect;
export type DataDeletionRequest =
  typeof dataDeletionRequestsTable.$inferSelect;
