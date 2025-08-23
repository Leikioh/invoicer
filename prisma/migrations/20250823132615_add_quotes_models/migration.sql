-- CreateTable
CREATE TABLE `Quote` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REFUSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `issueDate` DATETIME(3) NULL,
    `expiryDate` DATETIME(3) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'EUR',
    `notes` VARCHAR(191) NULL,
    `subTotal` DECIMAL(12, 2) NULL,
    `taxTotal` DECIMAL(12, 2) NULL,
    `grandTotal` DECIMAL(12, 2) NULL,
    `invoiceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Quote_number_key`(`number`),
    UNIQUE INDEX `Quote_invoiceId_key`(`invoiceId`),
    INDEX `Quote_status_idx`(`status`),
    INDEX `Quote_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteLine` (
    `id` VARCHAR(191) NOT NULL,
    `quoteId` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `vatRate` DECIMAL(5, 2) NOT NULL,
    `lineTotalHt` DECIMAL(12, 2) NOT NULL,
    `lineTax` DECIMAL(12, 2) NOT NULL,
    `lineTotalTtc` DECIMAL(12, 2) NOT NULL,

    INDEX `QuoteLine_quoteId_idx`(`quoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteSequence` (
    `year` INTEGER NOT NULL,
    `lastNumber` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteLine` ADD CONSTRAINT `QuoteLine_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `invoiceline` RENAME INDEX `InvoiceLine_invoiceId_fkey` TO `InvoiceLine_invoiceId_idx`;
