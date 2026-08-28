import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp, { type Metadata } from 'sharp';
import { AppConfigService } from '../config/app-config.service';
import { FilesRepository } from './files.repository';

/** What the storefront can actually display. */
const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface StoredFile {
  id: number;
  storedName: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  checksumSha256: string;
}

/**
 * Product image storage.
 *
 * Files are named by the SHA-256 of their bytes, which is the same convention
 * the reference import used and gives deduplication for free — uploading the
 * same photograph against ten products stores one file and ten references.
 *
 * The bytes are the source of truth for type and dimensions, never the client:
 * a browser will happily send `image/png` for a renamed executable, so the
 * buffer is decoded before anything is written to disk.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly repository: FilesRepository,
    private readonly config: AppConfigService,
  ) {}

  private get productsDir(): string {
    return join(resolve(this.config.storageRoot), 'products');
  }

  /**
   * Stores an uploaded image and returns its File row.
   *
   * Re-uploading identical bytes returns the existing row rather than a second
   * copy — which also means deleting one product's media must never delete the
   * file while another product still references it. See `deleteIfOrphaned`.
   */
  async storeProductImage(
    buffer: Buffer,
    originalName: string,
    uploadedById: number | null,
  ): Promise<StoredFile> {
    return this.storeImage(buffer, originalName, uploadedById, {
      context: 'PRODUCT',
      isPublic: true,
      folder: 'products',
    });
  }

  /**
   * A customer's photo of their broken part (§24).
   *
   * Private and kept in its own folder: this is a photograph taken inside
   * someone's workshop, submitted so sales can identify a part. It is not
   * catalogue artwork and must never be served from a guessable public path.
   */
  async storeEnquiryPhoto(buffer: Buffer, originalName: string): Promise<StoredFile> {
    return this.storeImage(buffer, originalName, null, {
      context: 'ENQUIRY',
      isPublic: false,
      folder: 'enquiries',
    });
  }

  private async storeImage(
    buffer: Buffer,
    originalName: string,
    uploadedById: number | null,
    target: { context: 'PRODUCT' | 'ENQUIRY'; isPublic: boolean; folder: string },
  ): Promise<StoredFile> {
    if (buffer.length === 0) throw new BadRequestException('The uploaded file is empty');
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `Images must be ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB or smaller`,
      );
    }

    // Decoding is the type check. It rejects anything that is not really an
    // image regardless of what the filename or the declared mime type claim.
    let meta: Metadata;
    try {
      meta = await sharp(buffer).metadata();
    } catch {
      throw new BadRequestException('That file is not a readable image');
    }

    // sharp reports the decoded format ('jpeg', 'png', 'webp'…). ALLOWED maps
    // that to the extension we store under, which is where jpeg becomes .jpg.
    const mimeType = meta.format ? `image/${meta.format}` : '';
    const extension = ALLOWED.get(mimeType);
    if (!extension) {
      throw new BadRequestException(
        `Unsupported image type. Allowed: ${[...ALLOWED.keys()].join(', ')}`,
      );
    }

    const checksum = createHash('sha256').update(buffer).digest('hex');
    const storedName = `${checksum}.${extension}`;
    const relativePath = `${target.folder}/${storedName}`;

    const existing = await this.repository.findByChecksum(checksum, target.context);
    if (existing) {
      // The row exists, but the bytes may have been cleared from disk by a
      // deploy that did not carry storage across. Rewrite rather than hand back
      // a record pointing at nothing.
      await this.writeToDisk(target.folder, storedName, buffer, false);
      return this.toStored(existing);
    }

    await this.writeToDisk(target.folder, storedName, buffer, true);

    const file = await this.repository.create({
      originalName: originalName.slice(0, 255) || storedName,
      storedName,
      path: relativePath,
      mimeType,
      extension,
      sizeBytes: buffer.length,
      checksumSha256: checksum,
      width: meta.width ?? null,
      height: meta.height ?? null,
      uploadedById,
      context: target.context,
      isPublic: target.isPublic,
    });

    return this.toStored(file);
  }

  /**
   * Removes a file's bytes and row once nothing references it.
   *
   * Deduplication makes this necessary: unlinking on every media delete would
   * blank the image on every other product sharing it.
   */
  async deleteIfOrphaned(fileId: number): Promise<boolean> {
    const references = await this.repository.countReferences(fileId);
    if (references > 0) return false;

    const file = await this.repository.findById(fileId);
    if (!file) return false;

    // Other contexts (enquiry attachments, quote PDFs) reference files too;
    // only ever reap what was uploaded as product artwork.
    if (file.context !== 'PRODUCT') return false;

    try {
      const full = join(resolve(this.config.storageRoot), file.path);
      if (existsSync(full)) await unlink(full);
    } catch (error) {
      // A missing or locked file must not fail the request — the row going is
      // what matters, and an orphaned byte blob is harmless.
      this.logger.warn(`Could not remove ${file.path}: ${(error as Error).message}`);
    }

    await this.repository.delete(fileId);
    return true;
  }

  private async writeToDisk(
    folder: string,
    storedName: string,
    buffer: Buffer,
    required: boolean,
  ): Promise<void> {
    const dir = join(resolve(this.config.storageRoot), folder);
    await mkdir(dir, { recursive: true });
    const target = join(dir, storedName);
    if (!required && existsSync(target)) return;
    await writeFile(target, buffer);
  }

  private toStored(file: {
    id: number;
    storedName: string;
    path: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    checksumSha256: string;
  }): StoredFile {
    return {
      id: file.id,
      storedName: file.storedName,
      path: file.path,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      width: file.width,
      height: file.height,
      checksumSha256: file.checksumSha256,
    };
  }
}
