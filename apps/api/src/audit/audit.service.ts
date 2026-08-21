import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditAction } from '@lei/shared';
import { AuditRepository } from './audit.repository';

export interface AuditEntry {
  userId?: number;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Fields that are NEVER written to the audit log, on any entity.
 *
 * This is an allowlist problem solved with a denylist plus a whole-record
 * allowlist below — the denylist catches credential fields by name wherever
 * they appear, and `AUDITABLE_FIELDS` restricts what is captured at all.
 * A denylist alone forgets `passwordHash` exactly once.
 */
const NEVER_LOG = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'tokenHash',
  'token_hash',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'gstin',
]);

/**
 * Per-entity allowlist of fields worth recording. Anything not listed is
 * dropped, so adding a column to a table cannot silently start logging PII.
 */
const AUDITABLE_FIELDS: Record<string, string[]> = {
  User: ['name', 'email', 'role', 'department', 'isActive', 'mustChangePassword'],
  AdminPermission: ['module', 'canView', 'canCreate', 'canUpdate', 'canDelete'],
  Product: [
    'name',
    'slug',
    'categoryId',
    'partBrandId',
    'productType',
    'hsnCode',
    'gstRate',
    'isActive',
    'isFeatured',
  ],
  ProductVariant: [
    'sku',
    'partNumber',
    'variantName',
    'price',
    'priceType',
    'unitOfMeasure',
    'packSize',
    'isActive',
  ],
  Category: ['name', 'slug', 'parentId', 'isActive', 'sortOrder'],
  PartBrand: ['name', 'slug', 'isActive'],
  Inventory: ['quantity', 'reorderLevel', 'stockStatus', 'isManualOverride'],
  ProductCompatibility: ['productId', 'variantId', 'machineModelId', 'isVerified'],
  Customer: ['companyName', 'contactName', 'status', 'stateCode', 'isVerified'],
  Enquiry: ['status', 'priority', 'assignedToId'],
  Lead: ['status', 'priority', 'assignedToId', 'estimatedValue'],
  Quote: ['status', 'ownerId', 'acceptedRevisionId'],
  QuoteRevision: ['revisionNumber', 'total', 'taxTreatment', 'sentAt'],
  Setting: ['key', 'group'],
  RefreshToken: ['reason', 'revokedCount'],
};

/**
 * Audit logging.
 *
 * Written from ONE place (this service, driven by the AuditInterceptor) rather
 * than by hand in each module service. Hand-written audit calls across thirty
 * services guarantee gaps, and the gaps are invisible until someone asks who
 * changed a price.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repository: AuditRepository) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repository.create({
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        oldValues: this.redact(entry.entityType, entry.oldValues),
        newValues: this.redact(entry.entityType, entry.newValues),
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent?.slice(0, 255) ?? null,
      });
    } catch (error) {
      // Audit failure must never break the business operation that triggered
      // it — but it must be loud, because a silently failing audit trail is
      // worse than none.
      this.logger.error(
        `Failed to write audit entry (${entry.action} ${entry.entityType}): ${(error as Error).message}`,
      );
    }
  }

  /** Keeps only allowlisted fields, then strips anything credential-shaped. */
  private redact(
    entityType: string,
    values: Record<string, unknown> | undefined,
  ): Prisma.InputJsonObject | undefined {
    if (!values) return undefined;

    const allowed = AUDITABLE_FIELDS[entityType];
    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(values)) {
      if (NEVER_LOG.has(key)) continue;
      // Entities without an explicit allowlist record only scalars, which
      // keeps ad-hoc entries (reasons, counts) useful without capturing blobs.
      if (allowed && !allowed.includes(key)) continue;
      if (value === undefined) continue;
      if (value !== null && typeof value === 'object' && !allowed) continue;
      output[key] = value;
    }

    return Object.keys(output).length > 0 ? (output as Prisma.InputJsonObject) : undefined;
  }

  /** SUPER_ADMIN audit log viewer — thin passthrough to keep repositories out of controllers. */
  list(params: {
    skip: number;
    take: number;
    entityType?: string;
    entityId?: string;
    userId?: number;
  }) {
    return this.repository.list(params);
  }

  /** Only the fields that actually changed, for a compact diff. */
  diff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    for (const key of Object.keys(after)) {
      const a = before[key];
      const b = after[key];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        oldValues[key] = a;
        newValues[key] = b;
      }
    }

    return { oldValues, newValues };
  }
}
