-- AlterTable
ALTER TABLE `invoice` MODIFY `notes` TEXT NULL,
    MODIFY `statusReason` TEXT NULL;

-- AlterTable
ALTER TABLE `quote` MODIFY `notes` TEXT NULL;
