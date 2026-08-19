import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { EmailStatus } from '@lei/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.EmailLogUncheckedCreateInput) {
    return this.prisma.raw.emailLog.create({ data });
  }

  async markStatus(
    id: number,
    status: EmailStatus,
    extra: { providerId?: string; errorMessage?: string; sentAt?: Date } = {},
  ) {
    return this.prisma.raw.emailLog.update({
      where: { id },
      data: {
        status,
        attempts: { increment: 1 },
        ...(extra.providerId ? { providerId: extra.providerId } : {}),
        ...(extra.errorMessage ? { errorMessage: extra.errorMessage } : {}),
        ...(extra.sentAt ? { sentAt: extra.sentAt } : {}),
      },
    });
  }

  async recentFailures(limit = 20) {
    return this.prisma.raw.emailLog.findMany({
      where: { status: { in: ['FAILED', 'BOUNCED'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
