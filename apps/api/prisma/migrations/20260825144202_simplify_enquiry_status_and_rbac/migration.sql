-- ============================================================================
-- Migration: simplify_enquiry_status_and_rbac
-- 
-- 1. Migrate old enquiry statuses → new simplified pipeline stages
-- 2. Drop the admin_permissions table (RBAC removed)
-- 3. Drop department column from users
-- 4. Update users_role enum to OWNER only
-- 5. Update enquiries_status enum to new pipeline stages
-- ============================================================================

-- Step 1: Remap old statuses to new ones before altering the enum
UPDATE `enquiries`
SET `status` = CASE
  WHEN `status` IN ('ACKNOWLEDGED', 'IN_PROGRESS') THEN 'CALLED'
  WHEN `status` IN ('QUOTED', 'CLOSED_WON')        THEN 'CONFIRMED'
  WHEN `status` IN ('CLOSED_LOST', 'SPAM')          THEN 'CLOSED'
  ELSE 'NEW'
END;

-- Step 2: Drop admin_permissions (RBAC removal)
DROP TABLE IF EXISTS `admin_permissions`;

-- Step 3: Remove department column from users
ALTER TABLE `users`
  DROP COLUMN IF EXISTS `department`;

-- Step 4: Remap any old roles → OWNER
UPDATE `users` SET `role` = 'OWNER' WHERE `role` IN ('SUPER_ADMIN', 'ADMIN');

-- Step 5: Alter the enquiries status enum
ALTER TABLE `enquiries`
  MODIFY COLUMN `status` ENUM('NEW', 'CALLED', 'CONFIRMED', 'CLOSED') NOT NULL DEFAULT 'NEW';

-- Step 6: Alter the users role enum
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('OWNER') NOT NULL DEFAULT 'OWNER';

-- Step 7: Remove STOCK_ADJUST from audit log action enum (if present)
-- This is a safe NO-OP if STOCK_ADJUST values don't exist in the table
UPDATE `admin_audit_logs` SET `action` = 'UPDATE' WHERE `action` = 'STOCK_ADJUST';
ALTER TABLE `admin_audit_logs`
  MODIFY COLUMN `action` ENUM(
    'CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE', 'HARD_DELETE',
    'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET', 'PERMISSION_CHANGE',
    'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_REJECTED', 'IMPORT'
  ) NOT NULL;
