-- F1 Customer Behavior Tracking. Additive only: one new table, no changes to existing tables or rows.

-- CreateTable
CREATE TABLE `user_events` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `product_id` VARCHAR(191) NULL,
    `category_id` VARCHAR(191) NULL,
    `vendor_id` VARCHAR(191) NULL,
    `order_id` VARCHAR(191) NULL,
    `order_item_id` VARCHAR(191) NULL,
    `search_query` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `dedupe_key` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_events_dedupe_key_key`(`dedupe_key`),
    INDEX `user_events_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `user_events_type_created_at_idx`(`type`, `created_at`),
    INDEX `user_events_product_id_type_created_at_idx`(`product_id`, `type`, `created_at`),
    INDEX `user_events_category_id_type_created_at_idx`(`category_id`, `type`, `created_at`),
    INDEX `user_events_vendor_id_type_created_at_idx`(`vendor_id`, `type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_events` ADD CONSTRAINT `user_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
