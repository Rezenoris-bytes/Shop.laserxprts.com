import { Global, Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesRepository } from './files.repository';

/**
 * Global so the catalogue module can attach product artwork without importing
 * a files module that exists only to hand over one provider.
 */
@Global()
@Module({
  providers: [FilesService, FilesRepository],
  exports: [FilesService],
})
export class FilesModule {}
