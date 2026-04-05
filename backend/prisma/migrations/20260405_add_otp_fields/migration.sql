-- AddOtpFieldsToUsers
-- Migration: add_otp_fields
-- Adds OTP verification fields to the users table

ALTER TABLE `users`
  ADD COLUMN `otp_code` VARCHAR(255) NULL,
  ADD COLUMN `otp_expires_at` DATETIME(3) NULL,
  ADD COLUMN `otp_attempts` INT NOT NULL DEFAULT 0;
