import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.client.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  async findById(id: number) {
    return this.prisma.client.user.findUnique({ where: { id } });
  }

  async create(data: {
    name: string;
    email: string;
    emailNormalized: string;
    passwordHash: string;
    mustChangePassword: boolean;
  }) {
    return this.prisma.raw.user.create({
      data: { ...data, role: 'OWNER' },
    });
  }

  async setActive(id: number, isActive: boolean) {
    return this.prisma.raw.user.update({ where: { id }, data: { isActive } });
  }
}
