-- F2 Approved Discount Suggestions. Additive only: one new table, no changes to existing tables or rows.
-- Recommendations (F2) need no schema change: they are computed on demand from user_events and ranking scores.

-- CreateTable
CREATE TABLE `discount_suggestions` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `vendor_id` VARCHAR(191) NOT NULL,
    `reason_type` VARCHAR(40) NOT NULL,
    `suggested_type` ENUM('PERCENTAGE', 'FIXED') NOT NULL DEFAULT 'PERCENTAGE',
    `suggested_value` DOUBLE NOT NULL,
    `reason` TEXT NOT NULL,
    `metrics` TEXT NOT NULL,
    `pricing_snapshot` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `decided_by` VARCHAR(191) NULL,
    `decided_by_role` VARCHAR(191) NULL,
    `decided_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `discount_suggestions_vendor_id_status_created_at_idx`(`vendor_id`, `status`, `created_at`),
    INDEX `discount_suggestions_product_id_status_idx`(`product_id`, `status`),
    INDEX `discount_suggestions_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `discount_suggestions` ADD CONSTRAINT `discount_suggestions_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discount_suggestions` ADD CONSTRAINT `discount_suggestions_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
