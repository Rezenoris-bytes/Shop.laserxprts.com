-- ============================================================================
-- Constraints, generated columns, full-text indexes and immutability triggers
-- that the Prisma schema language cannot express.
--
-- Each block states WHY it exists, because none of these are obvious from the
-- schema alone and all of them protect a real failure mode.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AttributeValue: exactly one of product_id / variant_id must be set.
--
-- The Product/Variant boundary is decided by imported data, so a single table
-- carries both levels. Without this guard a row could belong to both a product
-- and a variant, or to neither, and filter queries would silently double-count.
--
-- Implemented as triggers rather than a CHECK constraint: MySQL rejects a CHECK
-- on any column that participates in a foreign-key referential action
-- (error 3823), and both columns here are FKs with ON UPDATE CASCADE.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_attribute_values_scope_insert`;

CREATE TRIGGER `trg_attribute_values_scope_insert`
BEFORE INSERT ON `attribute_values`
FOR EACH ROW
BEGIN
  IF (NEW.`product_id` IS NULL AND NEW.`variant_id` IS NULL)
  OR (NEW.`product_id` IS NOT NULL AND NEW.`variant_id` IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'attribute_values requires exactly one of product_id or variant_id';
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_attribute_values_scope_update`;

CREATE TRIGGER `trg_attribute_values_scope_update`
BEFORE UPDATE ON `attribute_values`
FOR EACH ROW
BEGIN
  IF (NEW.`product_id` IS NULL AND NEW.`variant_id` IS NULL)
  OR (NEW.`product_id` IS NOT NULL AND NEW.`variant_id` IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'attribute_values requires exactly one of product_id or variant_id';
  END IF;
END;

-- ----------------------------------------------------------------------------
-- 2. ProductCompatibility: prevent duplicate fitment rows.
--
-- A plain UNIQUE index will not work: MySQL treats every NULL as distinct, so
-- (product 1, variant NULL, model 5, machine_variant NULL) could be inserted
-- unlimited times and the product page would list "Raytools BM110" three times.
-- Generated columns collapse NULL to 0 so the unique index bites. VIRTUAL
-- rather than STORED: a stored column forces a table rebuild that MySQL cannot
-- perform alongside the existing foreign keys (error 1215).
-- ----------------------------------------------------------------------------
ALTER TABLE `product_compatibility`
  ADD COLUMN `variant_key` INT AS (IFNULL(`variant_id`, 0)) VIRTUAL,
  ADD COLUMN `machine_variant_key` INT AS (IFNULL(`machine_variant_id`, 0)) VIRTUAL;

ALTER TABLE `product_compatibility`
  ADD UNIQUE INDEX `uq_product_compatibility`
    (`product_id`, `variant_key`, `machine_model_id`, `machine_variant_key`);

-- ----------------------------------------------------------------------------
-- 3. Full-text indexes.
--
-- These are the LAST stage of the search pipeline, not the first. Exact and
-- prefix matching runs against product_variants.search_key before this, because
-- MySQL FULLTEXT splits on punctuation and drops short tokens — so a customer
-- typing the exact part number "D27.9 T4.1" would otherwise get nothing.
-- ----------------------------------------------------------------------------
ALTER TABLE `products`
  ADD FULLTEXT INDEX `ft_products` (`name`, `short_description`);

ALTER TABLE `product_variants`
  ADD FULLTEXT INDEX `ft_product_variants` (`variant_name`, `part_number`);

-- ----------------------------------------------------------------------------
-- 4. Quote revision immutability — second line of defence.
--
-- The service layer exposes no update method for these tables. This trigger
-- makes the guarantee structural: even a direct SQL edit, or a future
-- accidentally-added endpoint, cannot alter an issued quote.
--
-- Deliberately NOT fully immutable: pdf_file_id, sent_at and sent_to_email are
-- written after creation (the PDF is rendered from the saved revision, then
-- attached). Every commercial field is frozen.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_quote_revisions_immutable`;

CREATE TRIGGER `trg_quote_revisions_immutable`
BEFORE UPDATE ON `quote_revisions`
FOR EACH ROW
BEGIN
  IF NEW.`quote_id`        <> OLD.`quote_id`
  OR NEW.`revision_number` <> OLD.`revision_number`
  OR NEW.`subtotal`        <> OLD.`subtotal`
  OR NEW.`discount_amount` <> OLD.`discount_amount`
  OR NEW.`freight_amount`  <> OLD.`freight_amount`
  OR NEW.`taxable_amount`  <> OLD.`taxable_amount`
  OR NEW.`tax_treatment`   <> OLD.`tax_treatment`
  OR NEW.`cgst_amount`     <> OLD.`cgst_amount`
  OR NEW.`sgst_amount`     <> OLD.`sgst_amount`
  OR NEW.`igst_amount`     <> OLD.`igst_amount`
  OR NEW.`total`           <> OLD.`total`
  OR NEW.`created_at`      <> OLD.`created_at`
  THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'quote_revisions are immutable: create a new revision instead';
  END IF;
END;

-- Quote revision LINES are fully immutable — nothing legitimately updates them.
DROP TRIGGER IF EXISTS `trg_quote_revision_items_immutable`;

CREATE TRIGGER `trg_quote_revision_items_immutable`
BEFORE UPDATE ON `quote_revision_items`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'quote_revision_items are immutable: create a new revision instead';
END;

-- ----------------------------------------------------------------------------
-- 5. Append-only tables.
--
-- An audit trail that can be edited is not an audit trail, and a stock ledger
-- that can be rewritten cannot settle a stock dispute.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_admin_audit_logs_append_only`;

CREATE TRIGGER `trg_admin_audit_logs_append_only`
BEFORE UPDATE ON `admin_audit_logs`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'admin_audit_logs are append-only';
END;

DROP TRIGGER IF EXISTS `trg_stock_movements_append_only`;

CREATE TRIGGER `trg_stock_movements_append_only`
BEFORE UPDATE ON `stock_movements`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock_movements are append-only';
END;
