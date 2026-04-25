/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `orders` ADD COLUMN `coupon_code` VARCHAR(191) NULL,
    ADD COLUMN `discount_amount` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `discount_type` ENUM('PERCENTAGE', 'FIXED') NULL,
    ADD COLUMN `discount_value` DOUBLE NULL DEFAULT 0,
    MODIFY `status` ENUM('DRAFT', 'PENDING', 'ACTIVE', 'APPROVED', 'INACTIVE', 'REJECTED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `custom_role_id` VARCHAR(191) NULL,
    ADD COLUMN `password_reset_otp` VARCHAR(255) NULL,
    ADD COLUMN `password_reset_otp_expires` DATETIME(3) NULL,
    MODIFY `role` ENUM('CUSTOMER', 'VENDOR', 'STAFF', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER';

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `type` VARCHAR(191) NOT NULL DEFAULT 'info',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipping_rates` (
    `id` VARCHAR(191) NOT NULL,
    `governorate` VARCHAR(191) NOT NULL,
    `cost` DOUBLE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shipping_rates_governorate_key`(`governorate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcements` (
    `id` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custom_roles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `permissions` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `custom_roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_phone_key` ON `users`(`phone`);

-- CreateIndex
CREATE INDEX `users_custom_role_id_idx` ON `users`(`custom_role_id`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_custom_role_id_fkey` FOREIGN KEY (`custom_role_id`) REFERENCES `custom_roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendors` ADD CONSTRAINT `vendors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wishlist_items` ADD CONSTRAINT `wishlist_items_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wishlist_items` ADD CONSTRAINT `wishlist_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compare_items` ADD CONSTRAINT `compare_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX `addresses_user_id_idx` ON `addresses`(`user_id`);
DROP INDEX `addresses_user_id_fkey` ON `addresses`;

-- RedefineIndex
CREATE INDEX `cart_items_product_id_idx` ON `cart_items`(`product_id`);
DROP INDEX `cart_items_product_id_fkey` ON `cart_items`;

-- RedefineIndex
CREATE INDEX `categories_parent_id_idx` ON `categories`(`parent_id`);
DROP INDEX `categories_parent_id_fkey` ON `categories`;

-- RedefineIndex
CREATE INDEX `compare_items_product_id_idx` ON `compare_items`(`product_id`);
DROP INDEX `compare_items_product_id_fkey` ON `compare_items`;

-- RedefineIndex
CREATE INDEX `order_items_order_id_idx` ON `order_items`(`order_id`);
DROP INDEX `order_items_order_id_fkey` ON `order_items`;

-- RedefineIndex
CREATE INDEX `order_items_product_id_idx` ON `order_items`(`product_id`);
DROP INDEX `order_items_product_id_fkey` ON `order_items`;

-- RedefineIndex
CREATE INDEX `order_items_variant_id_idx` ON `order_items`(`variant_id`);
DROP INDEX `order_items_variant_id_fkey` ON `order_items`;

-- RedefineIndex
CREATE INDEX `order_status_history_order_id_idx` ON `order_status_history`(`order_id`);
DROP INDEX `order_status_history_order_id_fkey` ON `order_status_history`;

-- RedefineIndex
CREATE INDEX `products_brand_id_idx` ON `products`(`brand_id`);
DROP INDEX `products_brand_id_fkey` ON `products`;

-- RedefineIndex
CREATE INDEX `reviews_user_id_idx` ON `reviews`(`user_id`);
DROP INDEX `reviews_user_id_fkey` ON `reviews`;

-- RedefineIndex
CREATE INDEX `wishlist_items_product_id_idx` ON `wishlist_items`(`product_id`);
DROP INDEX `wishlist_items_product_id_fkey` ON `wishlist_items`;
