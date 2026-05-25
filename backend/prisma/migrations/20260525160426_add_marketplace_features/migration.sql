-- Idempotent: skip columns that already exist (e.g. partial/manual prod changes)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_method'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `orders` ADD COLUMN `payment_method` VARCHAR(191) NULL DEFAULT ''COD''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_status'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `orders` ADD COLUMN `payment_status` VARCHAR(191) NULL DEFAULT ''PENDING''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
