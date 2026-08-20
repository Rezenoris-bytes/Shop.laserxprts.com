import { Injectable } from '@nestjs/common';
import type { AdminDepartment, PermissionModule } from '@lei/shared';
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
        department: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        permissions: true,
      },
    });
  }

  async findById(id: number) {
    return this.prisma.client.user.findUnique({ where: { id }, include: { permissions: true } });
  }

  async create(data: {
    name: string;
    email: string;
    emailNormalized: string;
    passwordHash: string;
    department: AdminDepartment | null;
    mustChangePassword: boolean;
  }) {
    return this.prisma.raw.user.create({
      data: { ...data, role: 'ADMIN' },
    });
  }

  async setActive(id: number, isActive: boolean) {
    return this.prisma.raw.user.update({ where: { id }, data: { isActive } });
  }

  async setPermissions(
    userId: number,
    permissions: Array<{
      module: PermissionModule;
      canView: boolean;
      canCreate: boolean;
      canUpdate: boolean;
      canDelete: boolean;
    }>,
  ) {
    await this.prisma.raw.$transaction([
      this.prisma.raw.adminPermission.deleteMany({ where: { userId } }),
      this.prisma.raw.adminPermission.createMany({
        data: permissions.map((permission) => ({ ...permission, userId })),
      }),
    ]);
    return this.prisma.raw.adminPermission.findMany({ where: { userId } });
  }
}
