ALTER TABLE "user_notification_preference" ALTER COLUMN "email_enabled" SET DEFAULT false;
--> statement-breakpoint
-- Backfill existing rows to the new email defaults. Only high-signal triggers —
-- the ones that are *about you* — keep email on. Keep this list in sync with
-- EMAIL_DEFAULT_ENABLED_TRIGGERS in lib/notifications/types.ts.
--
-- Touches ONLY email_enabled. in_app_enabled and push_enabled are untouched.
UPDATE "user_notification_preference"
SET "email_enabled" = ("trigger_type" IN (
  'mention_comment',
  'mention_description',
  'task_assigned',
  'comment_reply',
  'comment_resolved',
  'due_date_today',
  'task_overdue'
));
