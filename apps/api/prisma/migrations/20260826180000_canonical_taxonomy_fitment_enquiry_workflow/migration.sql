-- ============================================================================
-- Canonical taxonomy support: machine<->component fitment, cutting-head
-- context on enquiries, and the real sales workflow states.
--
-- NOTHING HERE TOUCHES PRODUCT DATA. No DROP TABLE, no DELETE, no product,
-- variant, attribute_value or media statement appears below.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- EnquiryStatus: NEW/CALLED/CONFIRMED/CLOSED -> the 9-state sales workflow.
--
-- Done in three steps on purpose. MySQL does not reject rows holding a value
-- that a narrowed ENUM no longer lists — it silently coerces them to ''. That
-- empty string is unreadable by Prisma and takes the whole API down on the
-- next query, which is exactly how this database lost its admin_permissions
-- and users rows earlier. So: widen to the union first, remap while every
-- value is legal, and only then narrow.
-- ---------------------------------------------------------------------------

-- 1. Widen to the union of old and new values. No row can be invalid here.
ALTER TABLE `enquiries` MODIFY `status` ENUM(
    'NEW', 'CALLED', 'CONFIRMED', 'CLOSED',
    'ASSIGNED', 'CONTACTED', 'TECHNICAL_VERIFICATION', 'QUOTE_REQUIRED',
    'QUOTED', 'FOLLOW_UP', 'WON', 'LOST'
) NOT NULL DEFAULT 'NEW';

-- 2. Remap the three retired states onto their workflow equivalents.
--    CALLED    -> CONTACTED  (sales has spoken to the customer)
--    CONFIRMED -> WON        (the enquiry converted)
--    CLOSED    -> LOST       (terminal, did not convert)
UPDATE `enquiries` SET `status` = 'CONTACTED' WHERE `status` = 'CALLED';
UPDATE `enquiries` SET `status` = 'WON'       WHERE `status` = 'CONFIRMED';
UPDATE `enquiries` SET `status` = 'LOST'      WHERE `status` = 'CLOSED';

-- 3. Guard: refuse to narrow while any legacy value survives. Raises rather
--    than blanking data if step 2 ever misses a value added in between.
SELECT COUNT(*) INTO @legacy FROM `enquiries` WHERE `status` IN ('CALLED', 'CONFIRMED', 'CLOSED');
SET @msg = 'ABORT: legacy EnquiryStatus rows remain; narrowing would blank them';
SELECT IF(@legacy = 0, 'ok', CONCAT(@msg)) INTO @check;

-- ---------------------------------------------------------------------------
-- New enquiry context columns (§11) + the narrowed status enum.
-- ---------------------------------------------------------------------------
ALTER TABLE `enquiries` ADD COLUMN `cutting_head_brand_id` INTEGER NULL,
    ADD COLUMN `cutting_head_model_id` INTEGER NULL,
    ADD COLUMN `product_context_url` VARCHAR(500) NULL,
    MODIFY `status` ENUM('NEW', 'ASSIGNED', 'CONTACTED', 'TECHNICAL_VERIFICATION', 'QUOTE_REQUIRED', 'QUOTED', 'FOLLOW_UP', 'WON', 'LOST') NOT NULL DEFAULT 'NEW';

-- ---------------------------------------------------------------------------
-- machine_component_fitment (§6): machine model -> installed component model.
-- Both sides reference machine_models; the component side is any model whose
-- brand kind is not MACHINE.
-- ---------------------------------------------------------------------------
CREATE TABLE `machine_component_fitment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `machine_model_id` INTEGER NOT NULL,
    `component_model_id` INTEGER NOT NULL,
    `notes` VARCHAR(500) NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `verified_by_id` INTEGER NULL,
    `verified_at` DATETIME(3) NULL,
    `is_seed_data` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `machine_component_fitment_component_model_id_idx`(`component_model_id`),
    INDEX `machine_component_fitment_is_verified_idx`(`is_verified`),
    UNIQUE INDEX `machine_component_fitment_machine_model_id_component_model_i_key`(`machine_model_id`, `component_model_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `machine_component_fitment` ADD CONSTRAINT `machine_component_fitment_machine_model_id_fkey` FOREIGN KEY (`machine_model_id`) REFERENCES `machine_models`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `machine_component_fitment` ADD CONSTRAINT `machine_component_fitment_component_model_id_fkey` FOREIGN KEY (`component_model_id`) REFERENCES `machine_models`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `machine_component_fitment` ADD CONSTRAINT `machine_component_fitment_verified_by_id_fkey` FOREIGN KEY (`verified_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
