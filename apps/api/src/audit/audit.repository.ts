import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.AdminAuditLogUncheckedCreateInput) {
    return this.prisma.raw.adminAuditLog.create({ data });
  }

  /** SUPER_ADMIN only — enforced by the permission guard on the controller. */
  async list(params: {
    skip: number;
    take: number;
    entityType?: string;
    entityId?: string;
    userId?: number;
  }) {
    const where = {
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.entityId ? { entityId: params.entityId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.raw.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.raw.adminAuditLog.count({ where }),
    ]);

    return { items, total };
  }
}
