import { Injectable } from '@nestjs/common';
import { AuditAction } from '@lei/shared';
import { AuditService } from '../audit/audit.service';
import { CustomersRepository } from './customers.repository';

@Injectable()
export class CustomersService {
  constructor(
    private readonly repository: CustomersRepository,
    private readonly audit: AuditService,
  ) {}

  list(params: { skip: number; take: number; q?: string }) {
    return this.repository.list(params);
  }

  findById(id: number) {
    return this.repository.findById(id);
  }

  async update(id: number, data: Record<string, unknown>, actorId: number) {
    const allowed = [
      'companyName',
      'contactName',
      'email',
      'phone',
      'gstin',
      'stateCode',
      'city',
      'status',
      'isVerified',
      'notes',
    ];
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([key]) => allowed.includes(key)),
    );
    const customer = await this.repository.update(id, filtered as never);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Customer',
      entityId: String(id),
      newValues: filtered,
    });
    return customer;
  }
}
