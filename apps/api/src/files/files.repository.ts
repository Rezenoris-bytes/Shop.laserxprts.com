import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Database access for stored files. */
@Injectable()
export class FilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByChecksum(checksum: string) {
    return this.prisma.client.file.findFirst({
      where: { checksumSha256: checksum, deletedAt: null },
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
  }) {
    return this.prisma.client.file.create({
      data: { ...data, context: 'PRODUCT', isPublic: true },
    });
  }

  /** How many product galleries still point at this file. */
  countReferences(fileId: number) {
    return this.prisma.client.productMedia.count({ where: { fileId } });
  }

  delete(id: number) {
    return this.prisma.client.file.delete({ where: { id } });
  }
}
