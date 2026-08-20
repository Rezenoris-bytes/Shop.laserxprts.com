import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction, UserRole, normalizeEmail, type AdminDepartment } from '@lei/shared';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import { UsersRepository } from './users.repository';
import { expandTemplate } from './permission-templates';

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
   * Creates an ADMIN with a temporary password and the department's default
   * permission template pre-filled — the template is a starting point the
   * caller can adjust, never the source of truth the guard reads.
   */
  async create(data: { name: string; email: string; department: AdminDepartment }, actorId: number) {
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
      department: data.department,
      mustChangePassword: true,
    });

    await this.repository.setPermissions(user.id, expandTemplate(data.department));

    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: String(user.id),
      newValues: { name: user.name, email: user.email, department: user.department },
    });

    // Returned once, in the response only — never logged, never emailed in
    // plaintext. The admin must change it on first login.
    return { user, temporaryPassword };
  }

  async deactivate(id: number, actorId: number) {
    const target = await this.repository.findById(id);
    if (target?.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot deactivate the Super Admin account');
    }
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

  async setPermissions(
    id: number,
    permissions: Parameters<UsersRepository['setPermissions']>[1],
    actorId: number,
  ) {
    const target = await this.repository.findById(id);
    if (target?.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Super Admin permissions cannot be edited');
    }
    const result = await this.repository.setPermissions(id, permissions);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.PERMISSION_CHANGE,
      entityType: 'User',
      entityId: String(id),
      newValues: { permissions },
    });
    return result;
  }
}
