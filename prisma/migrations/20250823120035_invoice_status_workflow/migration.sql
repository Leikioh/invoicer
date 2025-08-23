/*
  Warnings:

  - The values [PAID,OVERDUE] on the enum `Invoice_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `invoice` MODIFY `status` ENUM('DRAFT', 'SENT', 'VALIDATED', 'REFUSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT';
