-- AlterTable
ALTER TABLE `users` ADD COLUMN `password_reset_token` VARCHAR(191) NULL,
    ADD COLUMN `password_reset_expires` DATETIME(3) NULL;


    ALTER TABLE users
ADD COLUMN password_reset_token VARCHAR(255),
ADD COLUMN password_reset_expires DATETIME;
