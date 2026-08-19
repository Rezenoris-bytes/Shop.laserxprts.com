import { Module } from '@nestjs/common';
import { CatalogueController } from './catalogue.controller';
import { CatalogueRepository } from './catalogue.repository';
import { CatalogueService } from './catalogue.service';
import { CatalogueImportService } from './import/catalogue-import.service';

@Module({
  controllers: [CatalogueController],
  providers: [CatalogueService, CatalogueRepository, CatalogueImportService],
  exports: [CatalogueService, CatalogueRepository, CatalogueImportService],
})
export class CatalogueModule {}
