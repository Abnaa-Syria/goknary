-- AlterTable
ALTER TABLE `vendors` ADD COLUMN `exchange_policy` TEXT NULL,
    ADD COLUMN `exchange_policy_ar` TEXT NULL,
    ADD COLUMN `return_policy` TEXT NULL,
    ADD COLUMN `return_policy_ar` TEXT NULL,
    ADD COLUMN `return_window_days` INTEGER NULL,
    ADD COLUMN `shipping_policy` TEXT NULL,
    ADD COLUMN `shipping_policy_ar` TEXT NULL;
