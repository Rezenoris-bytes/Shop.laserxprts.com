-- CreateTable
CREATE TABLE `product_enrichment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'RESEARCHED', 'TECHNICALLY_VERIFIED', 'IMAGE_RESEARCHED', 'IMAGE_READY', 'CONTENT_READY', 'PUBLISHED', 'REVIEW_REQUIRED') NOT NULL DEFAULT 'DRAFT',
    `technical_status` ENUM('NOT_STARTED', 'TO_BE_VERIFIED', 'VERIFIED', 'NOT_AVAILABLE') NOT NULL DEFAULT 'NOT_STARTED',
    `compatibility_status` ENUM('NOT_STARTED', 'TO_BE_VERIFIED', 'VERIFIED', 'NOT_AVAILABLE') NOT NULL DEFAULT 'NOT_STARTED',
    `manufacturer` VARCHAR(150) NULL,
    `model_reference` VARCHAR(150) NULL,
    `part_number` VARCHAR(150) NULL,
    `proposed_name` VARCHAR(255) NULL,
    `content_source_url` VARCHAR(500) NULL,
    `source_type` VARCHAR(80) NULL,
    `image_rights` ENUM('UNKNOWN', 'OEM_PERMITTED', 'AUTHORIZED_SOURCE', 'LICENSED', 'LEI_OWNED', 'LEI_ORIGINAL', 'WATERMARKED', 'RIGHTS_UNCLEAR', 'REVIEW_REQUIRED') NOT NULL DEFAULT 'UNKNOWN',
    `image_search_term` VARCHAR(255) NULL,
    `image_source_url` VARCHAR(500) NULL,
    `image_not_used_reason` VARCHAR(500) NULL,
    `suggested_action` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `last_checked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_enrichment_product_id_key`(`product_id`),
    INDEX `product_enrichment_status_idx`(`status`),
    INDEX `product_enrichment_image_rights_idx`(`image_rights`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `market_candidates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `status` ENUM('MARKET_DISCOVERED', 'DUPLICATE_OF_EXISTING', 'NEW_PRODUCT_CANDIDATE', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'MARKET_DISCOVERED',
    `category_slug` VARCHAR(190) NULL,
    `component_brand` VARCHAR(150) NULL,
    `component_model` VARCHAR(150) NULL,
    `duplicate_of_product_id` INTEGER NULL,
    `source_url` VARCHAR(500) NULL,
    `rationale` TEXT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `market_candidates_status_idx`(`status`),
    UNIQUE INDEX `market_candidates_name_component_brand_key`(`name`, `component_brand`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_enrichment` ADD CONSTRAINT `product_enrichment_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

