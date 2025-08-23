-- AlterTable
ALTER TABLE `invoice` ADD COLUMN `refusedAt` DATETIME(3) NULL,
    ADD COLUMN `sentAt` DATETIME(3) NULL,
    ADD COLUMN `statusReason` VARCHAR(191) NULL,
    ADD COLUMN `validatedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Invoice_status_idx` ON `Invoice`(`status`);

-- RenameIndex
ALTER TABLE `invoice` RENAME INDEX `Invoice_customerId_fkey` TO `Invoice_customerId_idx`;
