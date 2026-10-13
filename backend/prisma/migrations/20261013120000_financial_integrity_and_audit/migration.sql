-- Persistent payout retry protection and processing attribution.
ALTER TABLE `payout_requests`
  ADD COLUMN `idempotency_key` VARCHAR(128) NULL,
  ADD COLUMN `request_fingerprint` CHAR(64) NULL,
  ADD COLUMN `processed_by` VARCHAR(191) NULL,
  ADD COLUMN `processed_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `payout_requests_vendor_id_idempotency_key_key`
  ON `payout_requests`(`vendor_id`, `idempotency_key`);

-- A delivered order may credit its vendor exactly once.
CREATE UNIQUE INDEX `commissions_order_id_key` ON `commissions`(`order_id`);

-- Durable, append-only record of privileged staff/admin mutations.
CREATE TABLE `admin_audit_logs` (
  `id` VARCHAR(191) NOT NULL,
  `actor_id` VARCHAR(191) NOT NULL,
  `actor_role` VARCHAR(32) NOT NULL,
  `action` VARCHAR(96) NOT NULL,
  `entity_type` VARCHAR(64) NOT NULL,
  `entity_id` VARCHAR(191) NULL,
  `metadata` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `admin_audit_logs_actor_id_created_at_idx`
  ON `admin_audit_logs`(`actor_id`, `created_at`);
CREATE INDEX `admin_audit_logs_entity_type_entity_id_idx`
  ON `admin_audit_logs`(`entity_type`, `entity_id`);
CREATE INDEX `admin_audit_logs_created_at_idx`
  ON `admin_audit_logs`(`created_at`);
