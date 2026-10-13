-- AlterTable
ALTER TABLE `products` ADD COLUMN `image_metadata` TEXT NULL;

-- AlterTable
ALTER TABLE `product_variants` ADD COLUMN `image_alt` VARCHAR(255) NULL,
    ADD COLUMN `image_alt_ar` VARCHAR(255) NULL;
