import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { skip: number; take: number; q?: string }) {
    const where: Prisma.CustomerWhereInput = params.q
      ? {
          OR: [
            { contactName: { contains: params.q } },
            { companyName: { contains: params.q } },
            { email: { contains: params.q } },
            { phone: { contains: params.q } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.client.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
          phone: true,
          status: true,
          isVerified: true,
          isSeedData: true,
          createdAt: true,
          _count: { select: { enquiries: true, quotes: true } },
        },
      }),
      this.prisma.client.customer.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: number) {
    return this.prisma.client.customer.findUnique({
      where: { id },
      include: {
        enquiries: { orderBy: { createdAt: 'desc' }, take: 10 },
        quotes: { orderBy: { createdAt: 'desc' }, take: 10 },
        addresses: true,
      },
    });
  }

  async update(id: number, data: Prisma.CustomerUncheckedUpdateInput) {
    return this.prisma.raw.customer.update({ where: { id }, data });
  }
}
