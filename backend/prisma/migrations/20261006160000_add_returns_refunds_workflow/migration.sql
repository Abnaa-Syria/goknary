-- F9 Returns & Refunds. Additive only: legacy enum values and rows are kept as they are.

-- The order_item_id foreign key needs an index; create the plain one before dropping the unique one
-- (partial returns allow several requests per order item).
CREATE INDEX `refund_requests_order_item_id_idx` ON `refund_requests`(`order_item_id`);

-- DropIndex
DROP INDEX `refund_requests_order_item_id_key` ON `refund_requests`;

-- AlterTable
ALTER TABLE `refund_requests` ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `gateway_refund_id` VARCHAR(191) NULL,
    ADD COLUMN `images` TEXT NULL,
    ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'RETURN',
    ADD COLUMN `manual_reference` VARCHAR(191) NULL,
    ADD COLUMN `processed_by` VARCHAR(191) NULL,
    ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `received_at` DATETIME(3) NULL,
    ADD COLUMN `refund_method` VARCHAR(191) NULL,
    ADD COLUMN `refunded_at` DATETIME(3) NULL,
    ADD COLUMN `vendor_decision` VARCHAR(191) NULL,
    MODIFY `order_item_id` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PENDING', 'VENDOR_APPROVED', 'VENDOR_REJECTED', 'ADMIN_APPROVED', 'ADMIN_REJECTED', 'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'ITEM_RECEIVED', 'REFUND_PROCESSING', 'REFUNDED', 'REJECTED') NOT NULL DEFAULT 'REQUESTED';

-- Legacy requests always covered the whole order item.
UPDATE `refund_requests` r
INNER JOIN `order_items` oi ON oi.`id` = r.`order_item_id`
SET r.`quantity` = oi.`quantity`;

-- CreateTable
CREATE TABLE `refund_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `refund_request_id` VARCHAR(191) NOT NULL,
    `from_status` ENUM('PENDING', 'VENDOR_APPROVED', 'VENDOR_REJECTED', 'ADMIN_APPROVED', 'ADMIN_REJECTED', 'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'ITEM_RECEIVED', 'REFUND_PROCESSING', 'REFUNDED', 'REJECTED') NULL,
    `to_status` ENUM('PENDING', 'VENDOR_APPROVED', 'VENDOR_REJECTED', 'ADMIN_APPROVED', 'ADMIN_REJECTED', 'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'ITEM_RECEIVED', 'REFUND_PROCESSING', 'REFUNDED', 'REJECTED') NOT NULL,
    `actor_id` VARCHAR(191) NULL,
    `actor_role` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `refund_status_history_refund_request_id_idx`(`refund_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `refund_requests_status_idx` ON `refund_requests`(`status`);

-- AddForeignKey
ALTER TABLE `refund_status_history` ADD CONSTRAINT `refund_status_history_refund_request_id_fkey` FOREIGN KEY (`refund_request_id`) REFERENCES `refund_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
