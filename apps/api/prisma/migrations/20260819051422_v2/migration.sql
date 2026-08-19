/*
  Warnings:

  - You are about to drop the column `machine_variant_key` on the `product_compatibility` table. All the data in the column will be lost.
  - You are about to drop the column `variant_key` on the `product_compatibility` table. All the data in the column will be lost.

*/
-- NOTE: product_compatibility_product_id_fkey, uq_product_compatibility,
--       ft_product_variants and ft_products were already removed in a prior
--       partial run — skipped here to avoid 1091 errors on re-apply.

-- AlterTable: only drop columns that still exist
SET @col1 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_compatibility' AND COLUMN_NAME = 'machine_variant_key');
SET @col2 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_compatibility' AND COLUMN_NAME = 'variant_key');
SET @sql1 = IF(@col1 > 0, 'ALTER TABLE `product_compatibility` DROP COLUMN `machine_variant_key`', 'SELECT 1');
SET @sql2 = IF(@col2 > 0, 'ALTER TABLE `product_compatibility` DROP COLUMN `variant_key`', 'SELECT 1');
PREPARE s1 FROM @sql1; EXECUTE s1; DEALLOCATE PREPARE s1;
PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;

-- AddForeignKey (guard against duplicate constraint)
SET @fkExists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enquiries' AND CONSTRAINT_NAME = 'enquiries_assigned_to_id_fkey');
SET @fkSql = IF(@fkExists = 0, 'ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE s3 FROM @fkSql; EXECUTE s3; DEALLOCATE PREPARE s3;
