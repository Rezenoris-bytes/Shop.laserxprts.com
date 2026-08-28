-- DropForeignKey
ALTER TABLE `inventory` DROP FOREIGN KEY `inventory_variant_id_fkey`;

-- DropForeignKey
ALTER TABLE `stock_movements` DROP FOREIGN KEY `stock_movements_performed_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `stock_movements` DROP FOREIGN KEY `stock_movements_variant_id_fkey`;

-- DropIndex
DROP INDEX `machine_brands_slug_key` ON `machine_brands`;

-- AlterTable
ALTER TABLE `admin_audit_logs` MODIFY `old_values` JSON NULL,
    MODIFY `new_values` JSON NULL;

-- AlterTable
ALTER TABLE `customer_events` MODIFY `metadata` JSON NULL;

-- AlterTable
ALTER TABLE `customers` DROP COLUMN `gstin`;

-- AlterTable
ALTER TABLE `import_jobs` MODIFY `type` ENUM('MACHINES', 'ATTRIBUTES', 'CATEGORIES', 'PART_BRANDS', 'PRODUCTS', 'VARIANTS', 'COMPATIBILITY', 'MEDIA') NOT NULL,
    MODIFY `error_report` JSON NULL;

-- AlterTable
ALTER TABLE `machine_brands` ADD COLUMN `kind` ENUM('MACHINE', 'CUTTING_HEAD', 'LASER_SOURCE', 'CHILLER', 'CONTROLLER', 'SERVO') NOT NULL DEFAULT 'MACHINE';

-- AlterTable
ALTER TABLE `products` DROP COLUMN `gst_rate`,
    DROP COLUMN `has_stock`,
    DROP COLUMN `hsn_code`,
    MODIFY `variant_axes` JSON NULL;

-- AlterTable
ALTER TABLE `quote_revision_items` DROP COLUMN `gst_amount`,
    DROP COLUMN `gst_rate`,
    DROP COLUMN `hsn_code_snapshot`;

-- AlterTable
ALTER TABLE `quote_revisions` DROP COLUMN `cgst_amount`,
    DROP COLUMN `igst_amount`,
    DROP COLUMN `sgst_amount`,
    DROP COLUMN `tax_treatment`,
    DROP COLUMN `taxable_amount`;

-- AlterTable
ALTER TABLE `search_query_logs` MODIFY `filters` JSON NULL;

-- AlterTable
ALTER TABLE `services` DROP COLUMN `gst_rate`,
    DROP COLUMN `sac_code`;

-- AlterTable
ALTER TABLE `users` ALTER COLUMN `role` DROP DEFAULT;

-- DropTable
DROP TABLE `inventory`;

-- DropTable
DROP TABLE `stock_movements`;

-- CreateIndex
CREATE INDEX `machine_brands_kind_is_active_sort_order_idx` ON `machine_brands`(`kind`, `is_active`, `sort_order`);

-- CreateIndex
CREATE UNIQUE INDEX `machine_brands_kind_slug_key` ON `machine_brands`(`kind`, `slug`);

