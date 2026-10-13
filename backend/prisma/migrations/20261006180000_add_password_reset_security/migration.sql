-- F13 Forgot password via email. Additive only: existing reset columns are reused and kept.
-- Existing users get password_changed_at = NULL, so their current sessions are unaffected.

-- AlterTable
ALTER TABLE `users` ADD COLUMN `password_reset_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `password_changed_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `users_password_reset_token_idx` ON `users`(`password_reset_token`);
