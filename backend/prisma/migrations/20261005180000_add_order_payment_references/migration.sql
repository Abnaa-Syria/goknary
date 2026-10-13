-- AlterTable
ALTER TABLE `orders` ADD COLUMN `paid_at` DATETIME(3) NULL,
    ADD COLUMN `payment_provider_order_id` VARCHAR(191) NULL,
    ADD COLUMN `payment_transaction_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `orders_payment_transaction_id_idx` ON `orders`(`payment_transaction_id`);
