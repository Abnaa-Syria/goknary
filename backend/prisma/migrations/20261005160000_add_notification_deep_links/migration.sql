-- AlterTable
ALTER TABLE `notifications` ADD COLUMN `entity_id` VARCHAR(191) NULL,
    ADD COLUMN `entity_type` VARCHAR(191) NULL,
    ADD COLUMN `link` VARCHAR(500) NULL,
    ADD COLUMN `message_ar` TEXT NULL,
    ADD COLUMN `title_ar` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `notifications_user_id_read_idx` ON `notifications`(`user_id`, `read`);

-- CreateIndex
CREATE INDEX `notifications_user_id_created_at_idx` ON `notifications`(`user_id`, `created_at`);
