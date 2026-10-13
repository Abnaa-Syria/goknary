-- Nullable for historical attempts. New online attempts receive one application-side.
ALTER TABLE `checkout_attempts` ADD COLUMN `expires_at` DATETIME(3) NULL;
CREATE INDEX `checkout_attempts_status_expires_at_idx` ON `checkout_attempts`(`status`, `expires_at`);
