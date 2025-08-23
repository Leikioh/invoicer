-- CreateTable
CREATE TABLE `Client` (
    `id` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `billingStreet` VARCHAR(191) NULL,
    `billingZip` VARCHAR(191) NULL,
    `billingCity` VARCHAR(191) NULL,
    `vatNumber` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Client_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `issueDate` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'EUR',
    `notes` VARCHAR(191) NULL,
    `subTotal` DECIMAL(12, 2) NULL,
    `taxTotal` DECIMAL(12, 2) NULL,
    `grandTotal` DECIMAL(12, 2) NULL,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_number_key`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceLine` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `vatRate` DECIMAL(5, 2) NOT NULL,
    `lineTotalHt` DECIMAL(12, 2) NOT NULL,
    `lineTax` DECIMAL(12, 2) NOT NULL,
    `lineTotalTtc` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceSequence` (
    `year` INTEGER NOT NULL,
    `lastNumber` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
