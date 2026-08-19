import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.client.setting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
  }

  async findByKeys(keys: string[]) {
    return this.prisma.client.setting.findMany({ where: { key: { in: keys } } });
  }

  async upsert(key: string, value: string, updatedById?: number) {
    return this.prisma.raw.setting.upsert({
      where: { key },
      update: { value, updatedById: updatedById ?? null },
      create: { key, value, updatedById: updatedById ?? null },
    });
  }
}
