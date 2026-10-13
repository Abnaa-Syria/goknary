-- Persistent checkout-level idempotency. Existing orders remain valid because
-- the new relation is nullable and no historical backfill is required.
CREATE TABLE `checkout_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `idempotency_key` VARCHAR(128) NOT NULL,
    `request_fingerprint` CHAR(64) NOT NULL,
    `payment_method` VARCHAR(32) NOT NULL,
    `status` ENUM('ORDERS_CREATED', 'PAYMENT_INITIATING', 'PAYMENT_READY', 'PAYMENT_FAILED', 'PAID', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ORDERS_CREATED',
    `provider_reference` VARCHAR(64) NOT NULL,
    `provider_session_id` VARCHAR(191) NULL,
    `provider_session_url` TEXT NULL,
    `provider_status` VARCHAR(64) NULL,
    `payment_initiation_started_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `checkout_attempts_user_id_idempotency_key_key`(`user_id`, `idempotency_key`),
    UNIQUE INDEX `checkout_attempts_provider_reference_key`(`provider_reference`),
    UNIQUE INDEX `checkout_attempts_provider_session_id_key`(`provider_session_id`),
    INDEX `checkout_attempts_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `orders` ADD COLUMN `checkout_attempt_id` VARCHAR(191) NULL;
CREATE INDEX `orders_checkout_attempt_id_idx` ON `orders`(`checkout_attempt_id`);

ALTER TABLE `checkout_attempts`
    ADD CONSTRAINT `checkout_attempts_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `orders`
    ADD CONSTRAINT `orders_checkout_attempt_id_fkey`
    FOREIGN KEY (`checkout_attempt_id`) REFERENCES `checkout_attempts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
