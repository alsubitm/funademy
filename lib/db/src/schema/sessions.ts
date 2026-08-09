import {
  pgTable,
  text,
  serial,
  integer,
  real,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { childrenTable } from "./children";

/** A recurring/named group of live sessions (e.g. a weekly robotics class). */
export const sessionSeriesTable = pgTable("session_series", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  program: text("program").notNull().default(""), // program/course label
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A single scheduled online session. Times stored as timestamptz (UTC); clients render Riyadh time. */
export const liveSessionsTable = pgTable("live_sessions", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").references(() => sessionSeriesTable.id, {
    onDelete: "set null",
  }),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  program: text("program").notNull().default(""),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  capacity: integer("capacity").notNull().default(10),
  /** null or 0 = free */
  priceSar: real("price_sar"),
  /** true = an active/trial subscription entitles booking at no extra cost */
  includedInSubscription: boolean("included_in_subscription")
    .notNull()
    .default(false),
  meetingLink: text("meeting_link").notNull().default(""),
  status: text("status").notNull().default("scheduled"), // scheduled | cancelled | completed
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessionBookingsTable = pgTable(
  "session_bookings",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => liveSessionsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** the child attending, when a parent books for a child */
    childId: integer("child_id").references(() => childrenTable.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("booked"), // booked | waitlisted | cancelled | attended
    /** how the booking was entitled: free | subscription | package | single */
    paymentMethod: text("payment_method").notNull().default("free"),
    /** provider charge reference for single purchases (needed for refunds) */
    paymentReference: text("payment_reference"),
    /**
     * Durable payment state for single purchases so provider side effects are
     * never rolled back with a DB transaction:
     * none | charge_pending | charged | refund_pending | refunded
     */
    paymentState: text("payment_state").notNull().default("none"),
    /** provider refund reference once a refund settles */
    refundReference: text("refund_reference"),
    /** the package whose credit paid for this booking (for exact refunds) */
    packageId: integer("package_id").references(
      () => sessionPackagesTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("session_bookings_session_user_uq").on(t.sessionId, t.userId)],
);

export const sessionAttendanceTable = pgTable(
  "session_attendance",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => liveSessionsTable.id, { onDelete: "cascade" }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => sessionBookingsTable.id, { onDelete: "cascade" }),
    childId: integer("child_id").references(() => childrenTable.id, {
      onDelete: "set null",
    }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // present | absent | late
    markedById: integer("marked_by_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    markedAt: timestamp("marked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("session_attendance_booking_uq").on(t.bookingId)],
);

export const sessionMaterialsTable = pgTable("session_materials", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => liveSessionsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("link"), // file | link | note
  title: text("title").notNull(),
  url: text("url"),
  content: text("content"),
  createdById: integer("created_by_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Prepaid multi-session credit packages. */
export const sessionPackagesTable = pgTable("session_packages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  totalCredits: integer("total_credits").notNull(),
  remainingCredits: integer("remaining_credits").notNull(),
  priceSar: real("price_sar").notNull(),
  /**
   * Durable purchase state: charge_pending | charged | failed.
   * Credits are only usable once charged (verified provider payment).
   */
  paymentState: text("payment_state").notNull().default("charge_pending"),
  /** provider charge reference (idempotency + refunds) */
  paymentReference: text("payment_reference"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Queued notifications (booking confirm, reminders, cancellations, waitlist promotion). */
export const sessionNotificationsTable = pgTable(
  "session_notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => liveSessionsTable.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(), // booking_confirmed | booking_cancelled | session_cancelled | waitlist_promoted | reminder_24h | reminder_1h
    message: text("message").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("session_notifications_dedupe_uq").on(
      t.userId,
      t.sessionId,
      t.type,
    ),
  ],
);

export const insertSessionSeriesSchema = createInsertSchema(
  sessionSeriesTable,
).omit({ id: true, createdAt: true });
export const insertLiveSessionSchema = createInsertSchema(
  liveSessionsTable,
).omit({ id: true, createdAt: true });

export type SessionSeries = typeof sessionSeriesTable.$inferSelect;
export type LiveSession = typeof liveSessionsTable.$inferSelect;
export type SessionBooking = typeof sessionBookingsTable.$inferSelect;
export type SessionAttendance = typeof sessionAttendanceTable.$inferSelect;
export type SessionMaterial = typeof sessionMaterialsTable.$inferSelect;
export type SessionPackage = typeof sessionPackagesTable.$inferSelect;
export type SessionNotification = typeof sessionNotificationsTable.$inferSelect;
export type InsertSessionSeries = z.infer<typeof insertSessionSeriesSchema>;
export type InsertLiveSession = z.infer<typeof insertLiveSessionSchema>;
