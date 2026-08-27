-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ye_format" AS ENUM ('online', 'in_person');

-- CreateEnum
CREATE TYPE "ye_trial_communication_kind" AS ENUM ('reminder', 'follow_up');

-- CreateEnum
CREATE TYPE "ye_trial_communication_status" AS ENUM ('pending', 'sending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "ye_booking_status" AS ENUM ('new', 'contacted', 'enrolled');

-- CreateEnum
CREATE TYPE "ye_contact_channel" AS ENUM ('whatsapp', 'email', 'phone');

-- CreateEnum
CREATE TYPE "ye_trial_attendance" AS ENUM ('pending', 'present', 'absent');

-- CreateEnum
CREATE TYPE "ye_chat_role" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "ye_chat_conversation_status" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "ye_chat_action_kind" AS ENUM ('request_makeup', 'book_consultation', 'book_trial');

-- CreateEnum
CREATE TYPE "ye_chat_action_status" AS ENUM ('prepared', 'confirmed', 'executing', 'succeeded', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "ye_session_status" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ye_enrollment_status" AS ENUM ('pending', 'active', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "ye_payment_kind" AS ENUM ('enrollment', 'renewal');

-- CreateEnum
CREATE TYPE "ye_payment_tx_status" AS ENUM ('initiated', 'paid', 'failed', 'expired', 'refunding', 'refunded');

-- CreateEnum
CREATE TYPE "ye_makeup_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ye_attendance_status" AS ENUM ('present', 'absent', 'late', 'excused');

-- CreateEnum
CREATE TYPE "ye_skill_status" AS ENUM ('in_progress', 'mastered');

-- CreateEnum
CREATE TYPE "ye_brick_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "AppointmentKind" AS ENUM ('trial', 'consult');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('scheduled', 'cancelled');

-- CreateEnum
CREATE TYPE "ye_lrn_band" AS ENUM ('explorers', 'builders', 'achievers', 'graduates');

-- CreateEnum
CREATE TYPE "ye_lrn_status" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "ye_lrn_video_type" AS ENUM ('youtube', 'vimeo', 'mp4');

-- CreateEnum
CREATE TYPE "ye_lrn_exercise_type" AS ENUM ('multiple_choice', 'matching', 'fill_blank', 'picture_select');

-- CreateTable
CREATE TABLE "ye_programs" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "kitCode" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER NOT NULL,
    "format" "ye_format" NOT NULL,
    "color" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "taglineEn" TEXT NOT NULL,
    "taglineAr" TEXT NOT NULL,
    "descEn" TEXT NOT NULL,
    "descAr" TEXT NOT NULL,
    "buildsEn" TEXT[],
    "buildsAr" TEXT[],
    "termsEn" TEXT[],
    "termsAr" TEXT[],
    "coverImageUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ye_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_schedule_slots" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "format" "ye_format" NOT NULL,
    "location" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 12,
    "seatsLeft" INTEGER NOT NULL DEFAULT 12,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ye_schedule_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_bookings" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "slotId" INTEGER NOT NULL,
    "parentName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "childFirstName" TEXT NOT NULL,
    "childBirthYear" INTEGER NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "status" "ye_booking_status" NOT NULL DEFAULT 'new',
    "email" TEXT,
    "contactChannel" "ye_contact_channel" NOT NULL DEFAULT 'whatsapp',
    "contactConsentAt" TIMESTAMP(3),
    "trialStartsAt" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "assignedTo" TEXT NOT NULL DEFAULT 'فريق القبول',
    "trialAttendance" "ye_trial_attendance" NOT NULL DEFAULT 'pending',
    "attendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_trial_communications" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "kind" "ye_trial_communication_kind" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "ye_trial_communication_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_trial_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_families" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "email" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_chat_conversations" (
    "id" TEXT NOT NULL,
    "familyId" INTEGER,
    "visitorTokenHash" TEXT,
    "title" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "status" "ye_chat_conversation_status" NOT NULL DEFAULT 'open',
    "contactMethod" TEXT,
    "contactValue" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentVersion" TEXT NOT NULL DEFAULT 'chat-v1',
    "familyVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ye_chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ye_chat_role" NOT NULL,
    "content" TEXT NOT NULL,
    "sourceRefs" JSONB,
    "providerId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ye_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_chat_escalations" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "contactMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ye_chat_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_chat_audit" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "familyId" INTEGER,
    "event" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ye_chat_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_chat_action_audit" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "familyId" INTEGER,
    "kind" "ye_chat_action_kind" NOT NULL,
    "status" "ye_chat_action_status" NOT NULL DEFAULT 'prepared',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "errorCode" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "executionStartedAt" TIMESTAMP(3),
    "executionAttempts" INTEGER NOT NULL DEFAULT 0,
    "executedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ye_chat_action_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_students" (
    "id" SERIAL NOT NULL,
    "familyId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "nationalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_otp_codes" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "delivered" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_admin_alerts" (
    "key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_admin_alerts_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ye_course_runs" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "titleAr" TEXT,
    "titleEn" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "weekday" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "format" "ye_format" NOT NULL,
    "location" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 12,
    "seatsLeft" INTEGER NOT NULL DEFAULT 12,
    "monthlyPriceSar" INTEGER NOT NULL DEFAULT 1380,
    "meetingUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ye_course_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_class_sessions" (
    "id" SERIAL NOT NULL,
    "courseRunId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "ye_session_status" NOT NULL DEFAULT 'scheduled',
    "note" TEXT,
    "meetingUrl" TEXT,
    "recordingUrl" TEXT,

    CONSTRAINT "ye_class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_enrollments" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "courseRunId" INTEGER NOT NULL,
    "status" "ye_enrollment_status" NOT NULL DEFAULT 'pending',
    "monthlyPriceSar" INTEGER NOT NULL DEFAULT 1380,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "paidThrough" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_payments" (
    "id" SERIAL NOT NULL,
    "familyId" INTEGER NOT NULL,
    "kind" "ye_payment_kind" NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "ye_payment_tx_status" NOT NULL DEFAULT 'paid',
    "subtotalSar" INTEGER NOT NULL,
    "discountSar" INTEGER NOT NULL DEFAULT 0,
    "totalSar" INTEGER NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_payment_items" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "enrollmentId" INTEGER,
    "studentName" TEXT NOT NULL,
    "programAr" TEXT NOT NULL,
    "programEn" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "baseSar" INTEGER NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "totalSar" INTEGER NOT NULL,
    "trialBookingId" INTEGER,

    CONSTRAINT "ye_payment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_attendance" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "status" "ye_attendance_status" NOT NULL,
    "note" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_makeup_requests" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "status" "ye_makeup_status" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "adminNote" TEXT,
    "makeupSessionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ye_makeup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_skills" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ye_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_student_skills" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "status" "ye_skill_status" NOT NULL DEFAULT 'in_progress',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ye_student_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_badges" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descAr" TEXT NOT NULL,
    "descEn" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL DEFAULT 'star',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ye_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_student_badges" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "badgeId" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_student_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_watan_bricks" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER,
    "authorName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ye_brick_status" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_watan_bricks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_testimonials" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "programEn" TEXT NOT NULL,
    "programAr" TEXT NOT NULL,
    "quoteEn" TEXT NOT NULL,
    "quoteAr" TEXT NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 5,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ye_testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_faqs" (
    "id" SERIAL NOT NULL,
    "questionEn" TEXT NOT NULL,
    "questionAr" TEXT NOT NULL,
    "answerEn" TEXT NOT NULL,
    "answerAr" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ye_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_brick_events" (
    "id" SERIAL NOT NULL,
    "ipHash" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_brick_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_click_events" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ye_click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_appointments" (
    "id" SERIAL NOT NULL,
    "kind" "AppointmentKind" NOT NULL,
    "parentName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "childFirstName" TEXT,
    "programId" INTEGER,
    "bookingId" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "meetUrl" TEXT,
    "calendarEventId" TEXT,
    "notes" TEXT,
    "consultKey" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_blog_posts" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT,
    "excerptAr" TEXT NOT NULL,
    "excerptEn" TEXT,
    "contentAr" TEXT NOT NULL,
    "contentEn" TEXT,
    "coverEmoji" TEXT NOT NULL DEFAULT '📚',
    "coverImageUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_lrn_subjects" (
    "id" SERIAL NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ye_lrn_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_lrn_units" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "band" "ye_lrn_band" NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "ye_lrn_status" NOT NULL DEFAULT 'published',

    CONSTRAINT "ye_lrn_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_lrn_lessons" (
    "id" SERIAL NOT NULL,
    "unitId" INTEGER NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descAr" TEXT,
    "descEn" TEXT,
    "videoUrl" TEXT,
    "videoType" "ye_lrn_video_type" NOT NULL DEFAULT 'youtube',
    "durationMinutes" INTEGER NOT NULL DEFAULT 8,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "ye_lrn_status" NOT NULL DEFAULT 'published',
    "isFreeSample" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ye_lrn_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_lrn_exercises" (
    "id" SERIAL NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "type" "ye_lrn_exercise_type" NOT NULL DEFAULT 'multiple_choice',
    "promptAr" TEXT NOT NULL,
    "promptEn" TEXT NOT NULL,
    "options" TEXT[],
    "correctAnswer" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ye_lrn_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_lrn_children" (
    "id" SERIAL NOT NULL,
    "familyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '⭐',
    "band" "ye_lrn_band" NOT NULL DEFAULT 'explorers',
    "pin" TEXT NOT NULL,
    "nationalId" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TEXT,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dailyLimitMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_lrn_children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_lrn_completions" (
    "id" SERIAL NOT NULL,
    "childId" INTEGER NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_lrn_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_lrn_first_completions" (
    "id" SERIAL NOT NULL,
    "childId" INTEGER NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_lrn_first_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_lrn_child_id_corrections" (
    "id" SERIAL NOT NULL,
    "childId" INTEGER,
    "childName" TEXT NOT NULL,
    "oldNationalId" TEXT NOT NULL,
    "newNationalId" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL DEFAULT 'admin',
    "supersededPending" INTEGER NOT NULL DEFAULT 0,
    "snapshotQueued" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_lrn_child_id_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_xapi_statements" (
    "id" SERIAL NOT NULL,
    "runId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "courseIri" TEXT NOT NULL,
    "verb" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "response" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'server',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_xapi_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_xapi_prepared_runs" (
    "id" SERIAL NOT NULL,
    "runId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "courseIri" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ye_xapi_prepared_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_xapi_outbox" (
    "id" SERIAL NOT NULL,
    "childId" INTEGER,
    "studentId" INTEGER,
    "nationalId" TEXT NOT NULL,
    "courseIri" TEXT NOT NULL,
    "verb" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "statement" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastHttpStatus" INTEGER,
    "source" TEXT,
    "voidReason" TEXT,
    "voidedBy" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "ye_xapi_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_xapi_outbox_flush_runs" (
    "id" SERIAL NOT NULL,
    "runId" TEXT NOT NULL,
    "statementIds" TEXT[],
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ye_xapi_outbox_flush_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ye_rate_limit_hits" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ye_rate_limit_hits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_counters" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "campaign_counters_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "campaign_brick_events" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_brick_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ye_programs_slug_key" ON "ye_programs"("slug");

-- CreateIndex
CREATE INDEX "ye_bookings_trialStartsAt_idx" ON "ye_bookings"("trialStartsAt");

-- CreateIndex
CREATE INDEX "ye_bookings_followUpAt_idx" ON "ye_bookings"("followUpAt");

-- CreateIndex
CREATE INDEX "ye_trial_communications_status_dueAt_idx" ON "ye_trial_communications"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "ye_trial_communications_bookingId_kind_key" ON "ye_trial_communications"("bookingId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ye_families_phone_key" ON "ye_families"("phone");

-- CreateIndex
CREATE INDEX "ye_chat_conversations_familyId_updatedAt_idx" ON "ye_chat_conversations"("familyId", "updatedAt");

-- CreateIndex
CREATE INDEX "ye_chat_conversations_visitorTokenHash_updatedAt_idx" ON "ye_chat_conversations"("visitorTokenHash", "updatedAt");

-- CreateIndex
CREATE INDEX "ye_chat_conversations_expiresAt_idx" ON "ye_chat_conversations"("expiresAt");

-- CreateIndex
CREATE INDEX "ye_chat_messages_conversationId_createdAt_idx" ON "ye_chat_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ye_chat_messages_expiresAt_idx" ON "ye_chat_messages"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ye_chat_messages_conversationId_idempotencyKey_key" ON "ye_chat_messages"("conversationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ye_chat_escalations_conversationId_createdAt_idx" ON "ye_chat_escalations"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ye_chat_escalations_status_createdAt_idx" ON "ye_chat_escalations"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ye_chat_escalations_expiresAt_idx" ON "ye_chat_escalations"("expiresAt");

-- CreateIndex
CREATE INDEX "ye_chat_audit_conversationId_createdAt_idx" ON "ye_chat_audit"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ye_chat_audit_expiresAt_idx" ON "ye_chat_audit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ye_chat_action_audit_idempotencyKey_key" ON "ye_chat_action_audit"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ye_chat_action_audit_conversationId_preparedAt_idx" ON "ye_chat_action_audit"("conversationId", "preparedAt");

-- CreateIndex
CREATE INDEX "ye_chat_action_audit_familyId_preparedAt_idx" ON "ye_chat_action_audit"("familyId", "preparedAt");

-- CreateIndex
CREATE INDEX "ye_chat_action_audit_expiresAt_idx" ON "ye_chat_action_audit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ye_students_nationalId_key" ON "ye_students"("nationalId");

-- CreateIndex
CREATE INDEX "ye_students_familyId_idx" ON "ye_students"("familyId");

-- CreateIndex
CREATE INDEX "ye_otp_codes_phone_createdAt_idx" ON "ye_otp_codes"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "ye_course_runs_programId_active_idx" ON "ye_course_runs"("programId", "active");

-- CreateIndex
CREATE INDEX "ye_class_sessions_courseRunId_date_idx" ON "ye_class_sessions"("courseRunId", "date");

-- CreateIndex
CREATE INDEX "ye_enrollments_courseRunId_status_idx" ON "ye_enrollments"("courseRunId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ye_enrollments_studentId_courseRunId_key" ON "ye_enrollments"("studentId", "courseRunId");

-- CreateIndex
CREATE INDEX "ye_payments_familyId_createdAt_idx" ON "ye_payments"("familyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ye_payment_items_trialBookingId_key" ON "ye_payment_items"("trialBookingId");

-- CreateIndex
CREATE INDEX "ye_payment_items_paymentId_idx" ON "ye_payment_items"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "ye_attendance_sessionId_studentId_key" ON "ye_attendance"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "ye_makeup_requests_status_createdAt_idx" ON "ye_makeup_requests"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ye_makeup_requests_studentId_sessionId_key" ON "ye_makeup_requests"("studentId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ye_skills_code_key" ON "ye_skills"("code");

-- CreateIndex
CREATE INDEX "ye_skills_programId_idx" ON "ye_skills"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "ye_student_skills_studentId_skillId_key" ON "ye_student_skills"("studentId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "ye_badges_code_key" ON "ye_badges"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ye_student_badges_studentId_badgeId_key" ON "ye_student_badges"("studentId", "badgeId");

-- CreateIndex
CREATE INDEX "ye_watan_bricks_status_createdAt_idx" ON "ye_watan_bricks"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ye_brick_events_ipHash_day_idx" ON "ye_brick_events"("ipHash", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ye_click_events_kind_page_day_key" ON "ye_click_events"("kind", "page", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ye_appointments_consultKey_key" ON "ye_appointments"("consultKey");

-- CreateIndex
CREATE INDEX "ye_appointments_phone_idx" ON "ye_appointments"("phone");

-- CreateIndex
CREATE INDEX "ye_appointments_startsAt_idx" ON "ye_appointments"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ye_blog_posts_slug_key" ON "ye_blog_posts"("slug");

-- CreateIndex
CREATE INDEX "ye_blog_posts_published_publishedAt_idx" ON "ye_blog_posts"("published", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ye_lrn_subjects_slug_key" ON "ye_lrn_subjects"("slug");

-- CreateIndex
CREATE INDEX "ye_lrn_units_subjectId_band_idx" ON "ye_lrn_units"("subjectId", "band");

-- CreateIndex
CREATE INDEX "ye_lrn_lessons_unitId_idx" ON "ye_lrn_lessons"("unitId");

-- CreateIndex
CREATE INDEX "ye_lrn_exercises_lessonId_idx" ON "ye_lrn_exercises"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "ye_lrn_children_nationalId_key" ON "ye_lrn_children"("nationalId");

-- CreateIndex
CREATE INDEX "ye_lrn_children_familyId_idx" ON "ye_lrn_children"("familyId");

-- CreateIndex
CREATE INDEX "ye_lrn_completions_childId_lessonId_idx" ON "ye_lrn_completions"("childId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "ye_lrn_first_completions_childId_lessonId_key" ON "ye_lrn_first_completions"("childId", "lessonId");

-- CreateIndex
CREATE INDEX "ye_xapi_statements_createdAt_idx" ON "ye_xapi_statements"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ye_xapi_prepared_runs_runId_key" ON "ye_xapi_prepared_runs"("runId");

-- CreateIndex
CREATE INDEX "ye_xapi_prepared_runs_expiresAt_idx" ON "ye_xapi_prepared_runs"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ye_xapi_outbox_statementId_key" ON "ye_xapi_outbox"("statementId");

-- CreateIndex
CREATE INDEX "ye_xapi_outbox_status_id_idx" ON "ye_xapi_outbox"("status", "id");

-- CreateIndex
CREATE INDEX "ye_xapi_outbox_childId_idx" ON "ye_xapi_outbox"("childId");

-- CreateIndex
CREATE INDEX "ye_xapi_outbox_studentId_idx" ON "ye_xapi_outbox"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ye_xapi_outbox_flush_runs_runId_key" ON "ye_xapi_outbox_flush_runs"("runId");

-- CreateIndex
CREATE INDEX "ye_xapi_outbox_flush_runs_expiresAt_idx" ON "ye_xapi_outbox_flush_runs"("expiresAt");

-- CreateIndex
CREATE INDEX "ye_rate_limit_hits_key_at_idx" ON "ye_rate_limit_hits"("key", "at");

-- CreateIndex
CREATE INDEX "campaign_brick_events_key_created_at_idx" ON "campaign_brick_events"("key", "created_at");

-- AddForeignKey
ALTER TABLE "ye_schedule_slots" ADD CONSTRAINT "ye_schedule_slots_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ye_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_bookings" ADD CONSTRAINT "ye_bookings_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ye_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_bookings" ADD CONSTRAINT "ye_bookings_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ye_schedule_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_trial_communications" ADD CONSTRAINT "ye_trial_communications_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ye_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_chat_conversations" ADD CONSTRAINT "ye_chat_conversations_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ye_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_chat_messages" ADD CONSTRAINT "ye_chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ye_chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_chat_escalations" ADD CONSTRAINT "ye_chat_escalations_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ye_chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_chat_action_audit" ADD CONSTRAINT "ye_chat_action_audit_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ye_chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_chat_action_audit" ADD CONSTRAINT "ye_chat_action_audit_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ye_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_students" ADD CONSTRAINT "ye_students_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ye_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_course_runs" ADD CONSTRAINT "ye_course_runs_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ye_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_class_sessions" ADD CONSTRAINT "ye_class_sessions_courseRunId_fkey" FOREIGN KEY ("courseRunId") REFERENCES "ye_course_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_enrollments" ADD CONSTRAINT "ye_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "ye_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_enrollments" ADD CONSTRAINT "ye_enrollments_courseRunId_fkey" FOREIGN KEY ("courseRunId") REFERENCES "ye_course_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_payments" ADD CONSTRAINT "ye_payments_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ye_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_payment_items" ADD CONSTRAINT "ye_payment_items_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ye_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_payment_items" ADD CONSTRAINT "ye_payment_items_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ye_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_payment_items" ADD CONSTRAINT "ye_payment_items_trialBookingId_fkey" FOREIGN KEY ("trialBookingId") REFERENCES "ye_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_attendance" ADD CONSTRAINT "ye_attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ye_class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_attendance" ADD CONSTRAINT "ye_attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "ye_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_makeup_requests" ADD CONSTRAINT "ye_makeup_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "ye_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_makeup_requests" ADD CONSTRAINT "ye_makeup_requests_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ye_class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_makeup_requests" ADD CONSTRAINT "ye_makeup_requests_makeupSessionId_fkey" FOREIGN KEY ("makeupSessionId") REFERENCES "ye_class_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_skills" ADD CONSTRAINT "ye_skills_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ye_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_student_skills" ADD CONSTRAINT "ye_student_skills_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "ye_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_student_skills" ADD CONSTRAINT "ye_student_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "ye_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_student_badges" ADD CONSTRAINT "ye_student_badges_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "ye_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_student_badges" ADD CONSTRAINT "ye_student_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "ye_badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_watan_bricks" ADD CONSTRAINT "ye_watan_bricks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "ye_students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_lrn_units" ADD CONSTRAINT "ye_lrn_units_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "ye_lrn_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_lrn_lessons" ADD CONSTRAINT "ye_lrn_lessons_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ye_lrn_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_lrn_exercises" ADD CONSTRAINT "ye_lrn_exercises_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ye_lrn_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_lrn_children" ADD CONSTRAINT "ye_lrn_children_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ye_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_lrn_completions" ADD CONSTRAINT "ye_lrn_completions_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ye_lrn_children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_lrn_completions" ADD CONSTRAINT "ye_lrn_completions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ye_lrn_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_lrn_first_completions" ADD CONSTRAINT "ye_lrn_first_completions_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ye_lrn_children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ye_lrn_first_completions" ADD CONSTRAINT "ye_lrn_first_completions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ye_lrn_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
