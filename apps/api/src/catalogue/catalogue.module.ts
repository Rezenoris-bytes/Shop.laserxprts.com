import { Module } from '@nestjs/common';
import { CatalogueController } from './catalogue.controller';
import { AdminCatalogueController } from './admin-catalogue.controller';
import { CatalogueRepository } from './catalogue.repository';
import { AdminCatalogueRepository } from './admin-catalogue.repository';
import { CatalogueService } from './catalogue.service';
import { AdminCatalogueService } from './admin-catalogue.service';
import { CatalogueImportService } from './import/catalogue-import.service';

@Module({
  controllers: [CatalogueController, AdminCatalogueController],
  providers: [
    CatalogueService,
    CatalogueRepository,
    AdminCatalogueService,
    AdminCatalogueRepository,
    CatalogueImportService,
  ],
  exports: [CatalogueService, CatalogueRepository, CatalogueImportService],
})
export class CatalogueModule {}
