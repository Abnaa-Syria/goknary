-- F10 Product review workflow. Additive only: no existing product status or value is changed.

-- AlterTable
ALTER TABLE `products` ADD COLUMN `rejection_reason` TEXT NULL,
    ADD COLUMN `reviewed_at` DATETIME(3) NULL,
    ADD COLUMN `reviewed_by` VARCHAR(191) NULL,
    ADD COLUMN `submitted_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `products_status_idx` ON `products`(`status`);
