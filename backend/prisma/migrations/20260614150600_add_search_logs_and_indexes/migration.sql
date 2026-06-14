-- AlterTable
CREATE INDEX `products_name_idx` ON `products`(`name`);
CREATE INDEX `products_description_idx` ON `products`(`description`(255));

-- CreateTable
CREATE TABLE `search_logs` (
    `id` VARCHAR(191) NOT NULL,
    `query` VARCHAR(191) NOT NULL,
    `results` INTEGER NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `search_logs_query_idx`(`query`),
    INDEX `search_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
