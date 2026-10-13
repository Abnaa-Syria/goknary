-- F4 general marketplace ranking: additive columns and indexes only.

-- AlterTable
ALTER TABLE `vendors` ADD COLUMN `ranking_score` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `ranking_updated_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `ranking_score` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `ranking_updated_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `vendors_ranking_score_idx` ON `vendors`(`ranking_score`);

-- CreateIndex
CREATE INDEX `products_ranking_score_idx` ON `products`(`ranking_score`);
