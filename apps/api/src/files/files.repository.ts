import { Injectable } from '@nestjs/common';
import type { FileContext } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Database access for stored files. */
@Injectable()
export class FilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dedup lookup, scoped by context.
   *
   * Scoped rather than global because the contexts differ in privacy: a
   * product image is public, an enquiry photo is not. A global match would
   * hand back the public row for identical bytes and silently publish a
   * customer's photograph.
   */
  findByChecksum(checksum: string, context: FileContext) {
    return this.prisma.client.file.findFirst({
      where: { checksumSha256: checksum, context, deletedAt: null },
    });
  }

  findById(id: number) {
    return this.prisma.client.file.findUnique({ where: { id } });
  }

  create(data: {
    originalName: string;
    storedName: string;
    path: string;
    mimeType: string;
    extension: string;
    sizeBytes: number;
    checksumSha256: string;
    width: number | null;
    height: number | null;
    uploadedById: number | null;
    context: FileContext;
    isPublic: boolean;
  }) {
    return this.prisma.client.file.create({ data });
  }

  /** How many product galleries still point at this file. */
  countReferences(fileId: number) {
    return this.prisma.client.productMedia.count({ where: { fileId } });
  }

  delete(id: number) {
    return this.prisma.client.file.delete({ where: { id } });
  }
}
