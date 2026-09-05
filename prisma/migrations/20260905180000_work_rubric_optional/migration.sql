-- DropForeignKey
ALTER TABLE `Work` DROP FOREIGN KEY `Work_rubricId_fkey`;

-- AlterTable
ALTER TABLE `Work` MODIFY `rubricId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Work` ADD CONSTRAINT `Work_rubricId_fkey` FOREIGN KEY (`rubricId`) REFERENCES `Rubric`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
