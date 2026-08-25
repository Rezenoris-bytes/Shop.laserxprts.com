import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction, UserRole, normalizeEmail } from '@lei/shared';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.repository.list();
  }

  /**
   * Creates an OWNER with a temporary password.
   */
  async create(
    data: { name: string; email: string },
    actorId: number,
  ) {
    const emailNormalized = normalizeEmail(data.email);
    const temporaryPassword = this.passwords
      .generateToken(9)
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12);

    const user = await this.repository.create({
      name: data.name,
      email: data.email,
      emailNormalized,
      passwordHash: await this.passwords.hash(temporaryPassword),
      mustChangePassword: true,
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: String(user.id),
      newValues: { name: user.name, email: user.email },
    });

    // Returned once, in the response only — never logged, never emailed in
    // plaintext. The admin must change it on first login.
    return { user, temporaryPassword };
  }

  async deactivate(id: number, actorId: number) {
    const target = await this.repository.findById(id);

    const user = await this.repository.setActive(id, false);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: String(id),
      newValues: { isActive: false },
    });
    return user;
  }

  async activate(id: number, actorId: number) {
    const user = await this.repository.setActive(id, true);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: String(id),
      newValues: { isActive: true },
    });
    return user;
  }


}
