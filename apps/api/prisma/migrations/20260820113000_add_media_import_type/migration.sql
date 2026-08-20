-- Adds MEDIA to ImportType, so product image imports can be tracked as jobs
-- alongside the other catalogue import passes.
--
-- Written by hand rather than generated: migration
-- 20260818113000_constraints_indexes_triggers installs fulltext indexes and
-- foreign keys that the Prisma schema does not model, so `prisma migrate dev`
-- reads them as drift and offers to reset the database. Hand-written migrations
-- plus `migrate resolve` are the safe path on this project.
ALTER TABLE `import_jobs`
  MODIFY `type` ENUM(
    'MACHINES','ATTRIBUTES','CATEGORIES','PART_BRANDS',
    'PRODUCTS','VARIANTS','COMPATIBILITY','INVENTORY','MEDIA'
  ) NOT NULL;
