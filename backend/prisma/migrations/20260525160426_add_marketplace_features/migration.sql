-- AlterTable
ALTER TABLE `orders` ADD COLUMN `payment_method` VARCHAR(191) NULL DEFAULT 'COD',
    ADD COLUMN `payment_status` VARCHAR(191) NULL DEFAULT 'PENDING';
