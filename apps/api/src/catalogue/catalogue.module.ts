import { Module } from '@nestjs/common';
import { CatalogueController } from './catalogue.controller';
import { AdminCatalogueController } from './admin-catalogue.controller';
import { CatalogueRepository } from './catalogue.repository';
import { AdminCatalogueRepository } from './admin-catalogue.repository';
import { CatalogueService } from './catalogue.service';
import { AdminCatalogueService } from './admin-catalogue.service';
import { CatalogueImportService } from './import/catalogue-import.service';
import { BulkProductUploadService } from './import/bulk-product-upload.service';
import { CompatibilityImportService } from './import/compatibility-import.service';
import { StorefrontRevalidationService } from './storefront-revalidation.service';
import { NozzleFamilyService } from './nozzle-family.service';

@Module({
  controllers: [CatalogueController, AdminCatalogueController],
  providers: [
    CatalogueService,
    CatalogueRepository,
    AdminCatalogueService,
    AdminCatalogueRepository,
    CatalogueImportService,
    BulkProductUploadService,
    CompatibilityImportService,
    StorefrontRevalidationService,
    NozzleFamilyService,
  ],
  exports: [CatalogueService, CatalogueRepository, CatalogueImportService, NozzleFamilyService],
})
export class CatalogueModule {}
