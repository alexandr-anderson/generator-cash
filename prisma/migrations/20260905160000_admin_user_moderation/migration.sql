-- AlterTable
ALTER TABLE `User` ADD COLUMN `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    ADD COLUMN `bannedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `User_createdAt_idx` ON `User`(`createdAt`);

-- CreateIndex
CREATE INDEX `User_role_idx` ON `User`(`role`);
