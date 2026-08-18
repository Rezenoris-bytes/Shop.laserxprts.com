-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `email_normalized` VARCHAR(190) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN') NOT NULL,
    `department` ENUM('SALES', 'SERVICE', 'CATALOGUE', 'CONTENT', 'OPERATIONS') NULL,
    `phone` VARCHAR(20) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `failed_login_count` TINYINT NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `password_changed_at` DATETIME(3) NULL,
    `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_email_normalized_key`(`email_normalized`),
    INDEX `users_role_is_active_idx`(`role`, `is_active`),
    INDEX `users_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `module` ENUM('CATALOGUE', 'INVENTORY', 'MACHINES', 'SERVICES', 'SERVICE_REQUESTS', 'CUSTOMERS', 'ENQUIRIES', 'LEADS', 'QUOTES', 'ORDERS', 'REPORTS', 'USERS', 'AUDIT', 'SETTINGS') NOT NULL,
    `can_view` BOOLEAN NOT NULL DEFAULT false,
    `can_create` BOOLEAN NOT NULL DEFAULT false,
    `can_update` BOOLEAN NOT NULL DEFAULT false,
    `can_delete` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `admin_permissions_user_id_idx`(`user_id`),
    UNIQUE INDEX `admin_permissions_user_id_module_key`(`user_id`, `module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `family_id` VARCHAR(36) NOT NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `revoked_reason` VARCHAR(64) NULL,
    `replaced_by_id` INTEGER NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    UNIQUE INDEX `refresh_tokens_replaced_by_id_key`(`replaced_by_id`),
    INDEX `refresh_tokens_user_id_family_id_idx`(`user_id`, `family_id`),
    INDEX `refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    INDEX `password_reset_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `action` ENUM('CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE', 'HARD_DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET', 'PERMISSION_CHANGE', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_REJECTED', 'STOCK_ADJUST', 'IMPORT') NOT NULL,
    `entity_type` VARCHAR(64) NOT NULL,
    `entity_id` VARCHAR(64) NULL,
    `old_values` JSON NULL,
    `new_values` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_audit_logs_entity_type_entity_id_created_at_idx`(`entity_type`, `entity_id`, `created_at`),
    INDEX `admin_audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `admin_audit_logs_action_created_at_idx`(`action`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `value_type` VARCHAR(20) NOT NULL DEFAULT 'string',
    `group` VARCHAR(50) NOT NULL DEFAULT 'general',
    `is_secret` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(255) NULL,
    `updated_by_id` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `settings_key_key`(`key`),
    INDEX `settings_group_idx`(`group`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counters` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scope` VARCHAR(50) NOT NULL,
    `period` VARCHAR(20) NOT NULL,
    `current_value` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `counters_scope_period_key`(`scope`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `original_name` VARCHAR(255) NOT NULL,
    `stored_name` VARCHAR(255) NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `extension` VARCHAR(16) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `checksum_sha256` CHAR(64) NOT NULL,
    `context` ENUM('PRODUCT', 'VARIANT', 'CATEGORY', 'PART_BRAND', 'MACHINE_BRAND', 'SERVICE', 'SERVICE_REQUEST', 'ENQUIRY', 'QUOTE', 'IMPORT') NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT true,
    `uploaded_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `files_stored_name_key`(`stored_name`),
    INDEX `files_context_created_at_idx`(`context`, `created_at`),
    INDEX `files_checksum_sha256_idx`(`checksum_sha256`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_derivatives` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `file_id` INTEGER NOT NULL,
    `variant` VARCHAR(20) NOT NULL,
    `format` VARCHAR(10) NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `size_bytes` INTEGER NOT NULL,

    UNIQUE INDEX `file_derivatives_file_id_variant_format_key`(`file_id`, `variant`, `format`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `to_email` VARCHAR(190) NOT NULL,
    `template` VARCHAR(64) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `status` ENUM('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `provider_id` VARCHAR(190) NULL,
    `entity_type` VARCHAR(64) NULL,
    `entity_id` VARCHAR(64) NULL,
    `error_message` TEXT NULL,
    `attempts` TINYINT NOT NULL DEFAULT 0,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_logs_status_created_at_idx`(`status`, `created_at`),
    INDEX `email_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `email_logs_to_email_idx`(`to_email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('MACHINES', 'ATTRIBUTES', 'CATEGORIES', 'PART_BRANDS', 'PRODUCTS', 'VARIANTS', 'COMPATIBILITY', 'INVENTORY') NOT NULL,
    `file_id` INTEGER NULL,
    `status` ENUM('PENDING', 'VALIDATING', 'VALIDATED', 'APPLYING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `total_rows` INTEGER NOT NULL DEFAULT 0,
    `processed_rows` INTEGER NOT NULL DEFAULT 0,
    `success_rows` INTEGER NOT NULL DEFAULT 0,
    `error_rows` INTEGER NOT NULL DEFAULT 0,
    `error_report` JSON NULL,
    `is_dry_run` BOOLEAN NOT NULL DEFAULT true,
    `started_by_id` INTEGER NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `import_jobs_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parent_id` INTEGER NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(190) NOT NULL,
    `description` TEXT NULL,
    `image_file_id` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `product_count` INTEGER NOT NULL DEFAULT 0,
    `meta_title` VARCHAR(255) NULL,
    `meta_description` VARCHAR(500) NULL,
    `canonical_override` VARCHAR(500) NULL,
    `seo_indexable` BOOLEAN NOT NULL DEFAULT true,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `categories_slug_key`(`slug`),
    INDEX `categories_parent_id_sort_order_idx`(`parent_id`, `sort_order`),
    INDEX `categories_is_active_deleted_at_idx`(`is_active`, `deleted_at`),
    INDEX `categories_is_seed_data_idx`(`is_seed_data`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `part_brands` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(190) NOT NULL,
    `logo_file_id` INTEGER NULL,
    `description` TEXT NULL,
    `website` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `part_brands_slug_key`(`slug`),
    INDEX `part_brands_is_active_deleted_at_idx`(`is_active`, `deleted_at`),
    INDEX `part_brands_is_seed_data_idx`(`is_seed_data`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category_id` INTEGER NOT NULL,
    `part_brand_id` INTEGER NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(190) NOT NULL,
    `product_type` ENUM('SPARE_PART', 'CONSUMABLE', 'COMPONENT', 'ACCESSORY', 'KIT') NOT NULL DEFAULT 'SPARE_PART',
    `short_description` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `hsn_code` VARCHAR(12) NULL,
    `gst_rate` DECIMAL(5, 2) NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `min_price` DECIMAL(14, 2) NULL,
    `max_price` DECIMAL(14, 2) NULL,
    `has_stock` BOOLEAN NOT NULL DEFAULT false,
    `variant_axes` JSON NULL,
    `meta_title` VARCHAR(255) NULL,
    `meta_description` VARCHAR(500) NULL,
    `canonical_override` VARCHAR(500) NULL,
    `og_title` VARCHAR(255) NULL,
    `og_description` VARCHAR(500) NULL,
    `og_image_file_id` INTEGER NULL,
    `seo_indexable` BOOLEAN NOT NULL DEFAULT true,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_by_id` INTEGER NULL,
    `updated_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,

    UNIQUE INDEX `products_slug_key`(`slug`),
    INDEX `products_category_id_is_active_deleted_at_idx`(`category_id`, `is_active`, `deleted_at`),
    INDEX `products_part_brand_id_is_active_idx`(`part_brand_id`, `is_active`),
    INDEX `products_is_featured_is_active_idx`(`is_featured`, `is_active`),
    INDEX `products_is_active_deleted_at_created_at_idx`(`is_active`, `deleted_at`, `created_at`),
    INDEX `products_min_price_idx`(`min_price`),
    INDEX `products_is_seed_data_idx`(`is_seed_data`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `sku` VARCHAR(64) NOT NULL,
    `part_number` VARCHAR(100) NOT NULL,
    `mpn` VARCHAR(100) NULL,
    `barcode` VARCHAR(64) NULL,
    `search_key` VARCHAR(255) NOT NULL,
    `variant_name` VARCHAR(120) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `price` DECIMAL(14, 2) NULL,
    `price_type` ENUM('FIXED', 'ON_REQUEST', 'CONTACT_SALES') NOT NULL DEFAULT 'FIXED',
    `mrp` DECIMAL(14, 2) NULL,
    `unit_of_measure` ENUM('PIECE', 'SET', 'PACK', 'METRE', 'LITRE', 'KG', 'HOUR', 'VISIT', 'LOT') NOT NULL DEFAULT 'PIECE',
    `pack_size` INTEGER NOT NULL DEFAULT 1,
    `min_order_qty` INTEGER NOT NULL DEFAULT 1,
    `lead_time_days` INTEGER NULL,
    `weight_grams` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `product_variants_sku_key`(`sku`),
    INDEX `product_variants_part_number_idx`(`part_number`),
    INDEX `product_variants_search_key_idx`(`search_key`),
    INDEX `product_variants_product_id_is_active_position_idx`(`product_id`, `is_active`, `position`),
    INDEX `product_variants_is_active_deleted_at_idx`(`is_active`, `deleted_at`),
    INDEX `product_variants_is_seed_data_idx`(`is_seed_data`),
    UNIQUE INDEX `product_variants_product_id_variant_name_key`(`product_id`, `variant_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_media` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `file_id` INTEGER NOT NULL,
    `type` ENUM('IMAGE', 'DATASHEET', 'BROCHURE', 'MANUAL', 'CERTIFICATE', 'DRAWING') NOT NULL DEFAULT 'IMAGE',
    `alt_text` VARCHAR(255) NULL,
    `title` VARCHAR(255) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_media_product_id_sort_order_idx`(`product_id`, `sort_order`),
    INDEX `product_media_product_id_is_primary_idx`(`product_id`, `is_primary`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attributes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(190) NOT NULL,
    `data_type` ENUM('STRING', 'DECIMAL', 'INTEGER', 'BOOLEAN', 'ENUM') NOT NULL DEFAULT 'STRING',
    `default_scope` ENUM('PRODUCT', 'VARIANT') NOT NULL DEFAULT 'VARIANT',
    `unit` VARCHAR(20) NULL,
    `is_filterable` BOOLEAN NOT NULL DEFAULT true,
    `is_searchable` BOOLEAN NOT NULL DEFAULT false,
    `show_in_specs` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attributes_slug_key`(`slug`),
    INDEX `attributes_is_filterable_sort_order_idx`(`is_filterable`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attribute_values` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attribute_id` INTEGER NOT NULL,
    `product_id` INTEGER NULL,
    `variant_id` INTEGER NULL,
    `value_string` VARCHAR(255) NULL,
    `value_decimal` DECIMAL(14, 4) NULL,
    `value_bool` BOOLEAN NULL,

    INDEX `attribute_values_attribute_id_value_decimal_idx`(`attribute_id`, `value_decimal`),
    INDEX `attribute_values_attribute_id_value_string_idx`(`attribute_id`, `value_string`(100)),
    UNIQUE INDEX `attribute_values_product_id_attribute_id_key`(`product_id`, `attribute_id`),
    UNIQUE INDEX `attribute_values_variant_id_attribute_id_key`(`variant_id`, `attribute_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variant_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `reserved_quantity` INTEGER NOT NULL DEFAULT 0,
    `reorder_level` INTEGER NOT NULL DEFAULT 0,
    `stock_status` ENUM('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'MADE_TO_ORDER', 'DISCONTINUED') NOT NULL DEFAULT 'OUT_OF_STOCK',
    `is_manual_override` BOOLEAN NOT NULL DEFAULT false,
    `location` VARCHAR(100) NULL,
    `last_counted_at` DATETIME(3) NULL,
    `updated_by_id` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_variant_id_key`(`variant_id`),
    INDEX `inventory_stock_status_idx`(`stock_status`),
    INDEX `inventory_quantity_idx`(`quantity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variant_id` INTEGER NOT NULL,
    `quantity_before` INTEGER NOT NULL,
    `quantity_change` INTEGER NOT NULL,
    `quantity_after` INTEGER NOT NULL,
    `reason` VARCHAR(50) NOT NULL,
    `reference` VARCHAR(100) NULL,
    `notes` VARCHAR(500) NULL,
    `performed_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movements_variant_id_created_at_idx`(`variant_id`, `created_at`),
    INDEX `stock_movements_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `machine_brands` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(190) NOT NULL,
    `logo_file_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `machine_brands_slug_key`(`slug`),
    INDEX `machine_brands_is_active_sort_order_idx`(`is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `machine_models` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `machine_brand_id` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(190) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `machine_models_machine_brand_id_is_active_idx`(`machine_brand_id`, `is_active`),
    UNIQUE INDEX `machine_models_machine_brand_id_slug_key`(`machine_brand_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `machine_variants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `machine_model_id` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `laser_type` VARCHAR(50) NULL,
    `power_watts` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `machine_variants_machine_model_id_is_active_idx`(`machine_model_id`, `is_active`),
    UNIQUE INDEX `machine_variants_machine_model_id_name_key`(`machine_model_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_compatibility` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `variant_id` INTEGER NULL,
    `machine_brand_id` INTEGER NOT NULL,
    `machine_model_id` INTEGER NOT NULL,
    `machine_variant_id` INTEGER NULL,
    `notes` VARCHAR(500) NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `verified_by_id` INTEGER NULL,
    `verified_at` DATETIME(3) NULL,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_compatibility_machine_model_id_product_id_idx`(`machine_model_id`, `product_id`),
    INDEX `product_compatibility_machine_brand_id_machine_model_id_idx`(`machine_brand_id`, `machine_model_id`),
    INDEX `product_compatibility_product_id_idx`(`product_id`),
    INDEX `product_compatibility_variant_id_idx`(`variant_id`),
    INDEX `product_compatibility_is_seed_data_idx`(`is_seed_data`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_type` ENUM('BUSINESS', 'INDIVIDUAL') NOT NULL DEFAULT 'BUSINESS',
    `company_name` VARCHAR(200) NULL,
    `contact_name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(190) NULL,
    `phone` VARCHAR(20) NULL,
    `email_normalized` VARCHAR(190) NULL,
    `phone_normalized` VARCHAR(20) NULL,
    `gstin` VARCHAR(15) NULL,
    `state_code` CHAR(2) NULL,
    `city` VARCHAR(100) NULL,
    `country` CHAR(2) NOT NULL DEFAULT 'IN',
    `status` ENUM('PROSPECT', 'ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'PROSPECT',
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `source` ENUM('WEBSITE_ENQUIRY', 'WEBSITE_QUOTE_REQUEST', 'SERVICE_REQUEST', 'PHONE', 'WHATSAPP', 'EMAIL', 'REFERRAL', 'EXHIBITION', 'MANUAL') NULL,
    `notes` TEXT NULL,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `customers_email_normalized_idx`(`email_normalized`),
    INDEX `customers_phone_normalized_idx`(`phone_normalized`),
    INDEX `customers_status_deleted_at_idx`(`status`, `deleted_at`),
    INDEX `customers_company_name_idx`(`company_name`),
    INDEX `customers_created_at_idx`(`created_at`),
    INDEX `customers_is_seed_data_idx`(`is_seed_data`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_addresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `label` VARCHAR(50) NULL,
    `line1` VARCHAR(255) NOT NULL,
    `line2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `state_code` CHAR(2) NULL,
    `pincode` VARCHAR(10) NOT NULL,
    `country` CHAR(2) NOT NULL DEFAULT 'IN',
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_billing` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customer_addresses_customer_id_is_default_idx`(`customer_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enquiries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `public_ref` VARCHAR(16) NOT NULL,
    `customer_id` INTEGER NULL,
    `type` ENUM('PRODUCT', 'SERVICE', 'BULK', 'GENERAL') NOT NULL DEFAULT 'PRODUCT',
    `status` ENUM('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'QUOTED', 'CLOSED_WON', 'CLOSED_LOST', 'SPAM') NOT NULL DEFAULT 'NEW',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `source` ENUM('WEBSITE_ENQUIRY', 'WEBSITE_QUOTE_REQUEST', 'SERVICE_REQUEST', 'PHONE', 'WHATSAPP', 'EMAIL', 'REFERRAL', 'EXHIBITION', 'MANUAL') NOT NULL DEFAULT 'WEBSITE_QUOTE_REQUEST',
    `contact_name` VARCHAR(150) NOT NULL,
    `contact_email` VARCHAR(190) NULL,
    `contact_phone` VARCHAR(20) NULL,
    `contact_company` VARCHAR(200) NULL,
    `contact_city` VARCHAR(100) NULL,
    `subject` VARCHAR(255) NULL,
    `message` TEXT NULL,
    `machine_brand_id` INTEGER NULL,
    `machine_model_id` INTEGER NULL,
    `machine_variant_id` INTEGER NULL,
    `consent_given` BOOLEAN NOT NULL DEFAULT false,
    `consent_text` VARCHAR(500) NULL,
    `consent_at` DATETIME(3) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `spam_score` TINYINT NOT NULL DEFAULT 0,
    `session_id` INTEGER NULL,
    `assigned_to_id` INTEGER NULL,
    `acknowledged_at` DATETIME(3) NULL,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `enquiries_public_ref_key`(`public_ref`),
    INDEX `enquiries_status_created_at_idx`(`status`, `created_at`),
    INDEX `enquiries_assigned_to_id_status_idx`(`assigned_to_id`, `status`),
    INDEX `enquiries_customer_id_created_at_idx`(`customer_id`, `created_at`),
    INDEX `enquiries_created_at_idx`(`created_at`),
    INDEX `enquiries_is_seed_data_idx`(`is_seed_data`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enquiry_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enquiry_id` INTEGER NOT NULL,
    `variant_id` INTEGER NULL,
    `service_id` INTEGER NULL,
    `product_name_snapshot` VARCHAR(255) NULL,
    `part_number_snapshot` VARCHAR(100) NULL,
    `unit_price_snapshot` DECIMAL(14, 2) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `customer_note` VARCHAR(500) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `enquiry_items_enquiry_id_sort_order_idx`(`enquiry_id`, `sort_order`),
    INDEX `enquiry_items_variant_id_idx`(`variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enquiry_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enquiry_id` INTEGER NOT NULL,
    `file_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `enquiry_attachments_enquiry_id_idx`(`enquiry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `enquiry_id` INTEGER NULL,
    `service_request_id` INTEGER NULL,
    `lead_type` ENUM('PRODUCT', 'SERVICE', 'BULK') NOT NULL DEFAULT 'PRODUCT',
    `source` ENUM('WEBSITE_ENQUIRY', 'WEBSITE_QUOTE_REQUEST', 'SERVICE_REQUEST', 'PHONE', 'WHATSAPP', 'EMAIL', 'REFERRAL', 'EXHIBITION', 'MANUAL') NOT NULL DEFAULT 'WEBSITE_ENQUIRY',
    `status` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'QUOTED', 'NEGOTIATION', 'WON', 'LOST', 'DORMANT') NOT NULL DEFAULT 'NEW',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `score` SMALLINT NULL,
    `estimated_value` DECIMAL(14, 2) NULL,
    `assigned_to_id` INTEGER NULL,
    `next_follow_up_at` DATETIME(3) NULL,
    `lost_reason` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leads_enquiry_id_key`(`enquiry_id`),
    UNIQUE INDEX `leads_service_request_id_key`(`service_request_id`),
    INDEX `leads_status_assigned_to_id_created_at_idx`(`status`, `assigned_to_id`, `created_at`),
    INDEX `leads_customer_id_idx`(`customer_id`),
    INDEX `leads_lead_type_status_idx`(`lead_type`, `status`),
    INDEX `leads_next_follow_up_at_idx`(`next_follow_up_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quote_number` VARCHAR(50) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `enquiry_id` INTEGER NULL,
    `current_revision_id` INTEGER NULL,
    `accepted_revision_id` INTEGER NULL,
    `status` ENUM('DRAFT', 'SENT', 'UNDER_REVISION', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `owner_id` INTEGER NULL,
    `accepted_at` DATETIME(3) NULL,
    `rejected_at` DATETIME(3) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quotes_quote_number_key`(`quote_number`),
    UNIQUE INDEX `quotes_current_revision_id_key`(`current_revision_id`),
    UNIQUE INDEX `quotes_accepted_revision_id_key`(`accepted_revision_id`),
    INDEX `quotes_customer_id_created_at_idx`(`customer_id`, `created_at`),
    INDEX `quotes_status_created_at_idx`(`status`, `created_at`),
    INDEX `quotes_owner_id_status_idx`(`owner_id`, `status`),
    INDEX `quotes_is_seed_data_idx`(`is_seed_data`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_revisions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quote_id` INTEGER NOT NULL,
    `revision_number` INTEGER NOT NULL,
    `valid_until` DATETIME(3) NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discount_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `freight_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxable_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `tax_treatment` ENUM('CGST_SGST', 'IGST', 'EXEMPT', 'ZERO_RATED') NOT NULL DEFAULT 'CGST_SGST',
    `cgst_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `sgst_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `igst_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `round_off` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `notes` TEXT NULL,
    `terms_snapshot` TEXT NULL,
    `payment_terms` VARCHAR(255) NULL,
    `delivery_terms` VARCHAR(255) NULL,
    `pdf_file_id` INTEGER NULL,
    `sent_at` DATETIME(3) NULL,
    `sent_to_email` VARCHAR(190) NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `quote_revisions_pdf_file_id_key`(`pdf_file_id`),
    INDEX `quote_revisions_quote_id_revision_number_idx`(`quote_id`, `revision_number`),
    INDEX `quote_revisions_valid_until_idx`(`valid_until`),
    UNIQUE INDEX `quote_revisions_quote_id_revision_number_key`(`quote_id`, `revision_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_revision_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quote_revision_id` INTEGER NOT NULL,
    `variant_id` INTEGER NULL,
    `service_id` INTEGER NULL,
    `product_name_snapshot` VARCHAR(255) NOT NULL,
    `part_number_snapshot` VARCHAR(100) NULL,
    `hsn_code_snapshot` VARCHAR(12) NULL,
    `description` TEXT NULL,
    `unit_of_measure` ENUM('PIECE', 'SET', 'PACK', 'METRE', 'LITRE', 'KG', 'HOUR', 'VISIT', 'LOT') NOT NULL DEFAULT 'PIECE',
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unit_price` DECIMAL(14, 2) NOT NULL,
    `discount_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `line_subtotal` DECIMAL(14, 2) NOT NULL,
    `gst_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `gst_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `line_total` DECIMAL(14, 2) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `quote_revision_items_quote_revision_id_sort_order_idx`(`quote_revision_id`, `sort_order`),
    INDEX `quote_revision_items_variant_id_idx`(`variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(190) NOT NULL,
    `description` TEXT NULL,
    `icon_file_id` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `service_categories_slug_key`(`slug`),
    INDEX `service_categories_is_active_sort_order_idx`(`is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service_category_id` INTEGER NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(190) NOT NULL,
    `short_description` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `pricing_type` ENUM('FIXED', 'PER_HOUR', 'PER_VISIT', 'ON_REQUEST', 'CONTACT_SALES') NOT NULL DEFAULT 'ON_REQUEST',
    `price` DECIMAL(14, 2) NULL,
    `sac_code` VARCHAR(12) NULL,
    `gst_rate` DECIMAL(5, 2) NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `meta_title` VARCHAR(255) NULL,
    `meta_description` VARCHAR(500) NULL,
    `canonical_override` VARCHAR(500) NULL,
    `seo_indexable` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `services_slug_key`(`slug`),
    INDEX `services_service_category_id_is_active_idx`(`service_category_id`, `is_active`),
    INDEX `services_is_active_deleted_at_idx`(`is_active`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `public_ref` VARCHAR(16) NOT NULL,
    `customer_id` INTEGER NULL,
    `service_id` INTEGER NOT NULL,
    `contact_name` VARCHAR(150) NOT NULL,
    `contact_email` VARCHAR(190) NULL,
    `contact_phone` VARCHAR(20) NULL,
    `contact_company` VARCHAR(200) NULL,
    `machine_brand_id` INTEGER NULL,
    `machine_model_id` INTEGER NULL,
    `machine_variant_id` INTEGER NULL,
    `laser_type_fallback` VARCHAR(50) NULL,
    `power_watts_fallback` INTEGER NULL,
    `serial_number` VARCHAR(100) NULL,
    `problem_description` TEXT NOT NULL,
    `preferred_date` DATE NULL,
    `location` VARCHAR(255) NULL,
    `status` ENUM('NEW', 'ASSIGNED', 'ASSESSMENT', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `assigned_to_id` INTEGER NULL,
    `consent_given` BOOLEAN NOT NULL DEFAULT false,
    `ip_address` VARCHAR(45) NULL,
    `assessment_notes` TEXT NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `service_requests_public_ref_key`(`public_ref`),
    INDEX `service_requests_status_created_at_idx`(`status`, `created_at`),
    INDEX `service_requests_assigned_to_id_status_idx`(`assigned_to_id`, `status`),
    INDEX `service_requests_customer_id_idx`(`customer_id`),
    INDEX `service_requests_service_id_idx`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_request_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service_request_id` INTEGER NOT NULL,
    `file_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `service_request_attachments_service_request_id_idx`(`service_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `visitor_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_key` VARCHAR(64) NOT NULL,
    `customer_id` INTEGER NULL,
    `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `referrer` VARCHAR(500) NULL,
    `utm_source` VARCHAR(100) NULL,
    `utm_medium` VARCHAR(100) NULL,
    `utm_campaign` VARCHAR(100) NULL,
    `landing_path` VARCHAR(500) NULL,

    UNIQUE INDEX `visitor_sessions_session_key_key`(`session_key`),
    INDEX `visitor_sessions_customer_id_idx`(`customer_id`),
    INDEX `visitor_sessions_last_seen_at_idx`(`last_seen_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NULL,
    `customer_id` INTEGER NULL,
    `event_type` ENUM('PAGE_VIEW', 'PRODUCT_VIEW', 'VARIANT_VIEW', 'CATEGORY_VIEW', 'SERVICE_VIEW', 'SEARCH', 'SEARCH_NO_RESULTS', 'FILTER_USED', 'COMPATIBILITY_SEARCH', 'QUOTE_REQUEST_START', 'QUOTE_REQUEST_ITEM_ADDED', 'QUOTE_REQUEST_ITEM_REMOVED', 'QUOTE_REQUEST_SUBMIT', 'BROCHURE_DOWNLOAD', 'WHATSAPP_CLICK', 'PHONE_CLICK', 'CONTACT_SUBMIT', 'LOGIN') NOT NULL,
    `entity_type` VARCHAR(64) NULL,
    `entity_id` INTEGER NULL,
    `path` VARCHAR(500) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_events_customer_id_created_at_idx`(`customer_id`, `created_at`),
    INDEX `customer_events_session_id_created_at_idx`(`session_id`, `created_at`),
    INDEX `customer_events_event_type_created_at_idx`(`event_type`, `created_at`),
    INDEX `customer_events_entity_type_entity_id_created_at_idx`(`entity_type`, `entity_id`, `created_at`),
    INDEX `customer_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_query_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `query` VARCHAR(255) NOT NULL,
    `normalized` VARCHAR(255) NOT NULL,
    `result_count` INTEGER NOT NULL,
    `session_id` INTEGER NULL,
    `filters` JSON NULL,
    `clicked_variant_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `search_query_logs_normalized_created_at_idx`(`normalized`, `created_at`),
    INDEX `search_query_logs_result_count_created_at_idx`(`result_count`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admin_permissions` ADD CONSTRAINT `admin_permissions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_replaced_by_id_fkey` FOREIGN KEY (`replaced_by_id`) REFERENCES `refresh_tokens`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `files` ADD CONSTRAINT `files_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_derivatives` ADD CONSTRAINT `file_derivatives_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_jobs` ADD CONSTRAINT `import_jobs_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_jobs` ADD CONSTRAINT `import_jobs_started_by_id_fkey` FOREIGN KEY (`started_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_part_brand_id_fkey` FOREIGN KEY (`part_brand_id`) REFERENCES `part_brands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_media` ADD CONSTRAINT `product_media_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_media` ADD CONSTRAINT `product_media_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attribute_values` ADD CONSTRAINT `attribute_values_attribute_id_fkey` FOREIGN KEY (`attribute_id`) REFERENCES `attributes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attribute_values` ADD CONSTRAINT `attribute_values_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attribute_values` ADD CONSTRAINT `attribute_values_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_performed_by_id_fkey` FOREIGN KEY (`performed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `machine_models` ADD CONSTRAINT `machine_models_machine_brand_id_fkey` FOREIGN KEY (`machine_brand_id`) REFERENCES `machine_brands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `machine_variants` ADD CONSTRAINT `machine_variants_machine_model_id_fkey` FOREIGN KEY (`machine_model_id`) REFERENCES `machine_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_compatibility` ADD CONSTRAINT `product_compatibility_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_compatibility` ADD CONSTRAINT `product_compatibility_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_compatibility` ADD CONSTRAINT `product_compatibility_machine_brand_id_fkey` FOREIGN KEY (`machine_brand_id`) REFERENCES `machine_brands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_compatibility` ADD CONSTRAINT `product_compatibility_machine_model_id_fkey` FOREIGN KEY (`machine_model_id`) REFERENCES `machine_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_compatibility` ADD CONSTRAINT `product_compatibility_machine_variant_id_fkey` FOREIGN KEY (`machine_variant_id`) REFERENCES `machine_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_compatibility` ADD CONSTRAINT `product_compatibility_verified_by_id_fkey` FOREIGN KEY (`verified_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_addresses` ADD CONSTRAINT `customer_addresses_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enquiry_items` ADD CONSTRAINT `enquiry_items_enquiry_id_fkey` FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enquiry_items` ADD CONSTRAINT `enquiry_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enquiry_items` ADD CONSTRAINT `enquiry_items_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enquiry_attachments` ADD CONSTRAINT `enquiry_attachments_enquiry_id_fkey` FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enquiry_attachments` ADD CONSTRAINT `enquiry_attachments_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_enquiry_id_fkey` FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_service_request_id_fkey` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_enquiry_id_fkey` FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_current_revision_id_fkey` FOREIGN KEY (`current_revision_id`) REFERENCES `quote_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_accepted_revision_id_fkey` FOREIGN KEY (`accepted_revision_id`) REFERENCES `quote_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_revisions` ADD CONSTRAINT `quote_revisions_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_revisions` ADD CONSTRAINT `quote_revisions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_revisions` ADD CONSTRAINT `quote_revisions_pdf_file_id_fkey` FOREIGN KEY (`pdf_file_id`) REFERENCES `files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_revision_items` ADD CONSTRAINT `quote_revision_items_quote_revision_id_fkey` FOREIGN KEY (`quote_revision_id`) REFERENCES `quote_revisions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_revision_items` ADD CONSTRAINT `quote_revision_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_revision_items` ADD CONSTRAINT `quote_revision_items_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_service_category_id_fkey` FOREIGN KEY (`service_category_id`) REFERENCES `service_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_machine_brand_id_fkey` FOREIGN KEY (`machine_brand_id`) REFERENCES `machine_brands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_machine_model_id_fkey` FOREIGN KEY (`machine_model_id`) REFERENCES `machine_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_machine_variant_id_fkey` FOREIGN KEY (`machine_variant_id`) REFERENCES `machine_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_request_attachments` ADD CONSTRAINT `service_request_attachments_service_request_id_fkey` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_request_attachments` ADD CONSTRAINT `service_request_attachments_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_events` ADD CONSTRAINT `customer_events_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `visitor_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_events` ADD CONSTRAINT `customer_events_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
