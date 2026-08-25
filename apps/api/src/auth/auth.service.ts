import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { AuditAction, normalizeEmail } from '@lei/shared';
import { AppConfigService } from '../config/app-config.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from './password.service';
import { AuthRepository, type AuthUser } from './auth.repository';

const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

export interface AccessTokenPayload {
  sub: number;
  role: string;
  /** Token version — bumped on password change so old access tokens die. */
  v: number;
}

export interface LoginResult {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repository: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  // ── Login ─────────────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    context: { ip?: string; userAgent?: string },
  ): Promise<LoginResult> {
    const normalized = normalizeEmail(email);
    const user = await this.repository.findByEmail(normalized);

    // Same failure message and comparable timing whether or not the account
    // exists, so the login form cannot be used to enumerate accounts.
    if (!user) {
      await this.passwords.verifyDummy(password);
      await this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        entityType: 'User',
        entityId: normalized,
        ipAddress: context.ip,
        userAgent: context.userAgent,
        newValues: { reason: 'unknown_email' },
      });
      throw new UnauthorizedException('Email or password is incorrect');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ForbiddenException(
        `Account temporarily locked after repeated failed attempts. Try again in ${minutes} minute(s).`,
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated.');
    }

    const valid = await this.passwords.verify(user.passwordHash, password);
    if (!valid) {
      const { locked } = await this.repository.recordFailedLogin(
        user.id,
        MAX_FAILED_ATTEMPTS,
        LOCK_MINUTES,
      );
      await this.audit.record({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entityType: 'User',
        entityId: String(user.id),
        ipAddress: context.ip,
        userAgent: context.userAgent,
        newValues: { locked },
      });
      if (locked) {
        this.logger.warn(`Account ${user.id} locked after ${MAX_FAILED_ATTEMPTS} failed attempts`);
      }
      throw new UnauthorizedException('Email or password is incorrect');
    }

    await this.repository.recordSuccessfulLogin(user.id);
    await this.audit.record({
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: String(user.id),
      ipAddress: context.ip,
      userAgent: context.userAgent,
    });

    return this.issueSession(user, randomUUID(), context);
  }

  // ── Refresh with reuse detection ──────────────────────────────────────

  /**
   * Rotates a refresh token.
   *
   * The security property that matters: presenting a token that has ALREADY
   * been rotated means it was captured and replayed. We cannot tell whether the
   * attacker or the legitimate user is holding the newer token, so the entire
   * family is revoked and both must log in again. Rotation without this check
   * provides the cost of rotating with none of the benefit.
   */
  async refresh(
    presentedToken: string,
    context: { ip?: string; userAgent?: string },
  ): Promise<LoginResult> {
    const tokenHash = this.passwords.hashToken(presentedToken);
    const stored = await this.repository.findRefreshToken(tokenHash);

    if (!stored) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    if (stored.revokedAt) {
      const revoked = await this.repository.revokeFamily(stored.familyId, 'reuse_detected');
      this.logger.error(
        `Refresh token reuse detected for user ${stored.userId}; revoked ${revoked} token(s) in family ${stored.familyId}`,
      );
      await this.audit.record({
        userId: stored.userId,
        action: AuditAction.LOGOUT,
        entityType: 'RefreshToken',
        entityId: String(stored.id),
        ipAddress: context.ip,
        userAgent: context.userAgent,
        newValues: { reason: 'reuse_detected', revokedCount: revoked },
      });
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    const user = await this.repository.findById(stored.userId);
    if (!user || !user.isActive) {
      await this.repository.revokeFamily(stored.familyId, 'user_inactive');
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    const session = await this.issueSession(user, stored.familyId, context);
    await this.repository.rotateRefreshToken(stored.id, session.refreshTokenId);
    return session;
  }

  async logout(
    presentedToken: string | undefined,
    context: { userId?: number; ip?: string; userAgent?: string },
  ): Promise<void> {
    if (!presentedToken) return;

    const stored = await this.repository.findRefreshToken(this.passwords.hashToken(presentedToken));
    if (!stored) return;

    await this.repository.revokeFamily(stored.familyId, 'logout');
    await this.audit.record({
      userId: stored.userId,
      action: AuditAction.LOGOUT,
      entityType: 'User',
      entityId: String(stored.userId),
      ipAddress: context.ip,
      userAgent: context.userAgent,
    });
  }

  // ── Password reset ────────────────────────────────────────────────────

  /**
   * Always resolves, whether or not the email exists. Returning "no such
   * account" here would leak the same information the login form is careful
   * not to. The caller sends the email only when a token comes back.
   */
  async requestPasswordReset(email: string): Promise<{ token: string; userId: number } | null> {
    const user = await this.repository.findByEmail(normalizeEmail(email));
    if (!user || !user.isActive) return null;

    await this.repository.invalidateUserResets(user.id);

    const token = this.passwords.generateToken(32);
    await this.repository.createPasswordReset({
      userId: user.id,
      tokenHash: this.passwords.hashToken(token),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });

    return { token, userId: user.id };
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const record = await this.repository.findPasswordReset(this.passwords.hashToken(token));

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('This reset link is invalid or has expired.');
    }

    await this.repository.setPassword(record.userId, await this.passwords.hash(newPassword));
    await this.repository.consumePasswordReset(record.id);

    // Any session opened with the old password is no longer trustworthy —
    // a password reset is often a response to a suspected compromise.
    const revoked = await this.repository.revokeAllForUser(record.userId, 'password_reset');

    await this.audit.record({
      userId: record.userId,
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: String(record.userId),
      newValues: { sessionsRevoked: revoked },
    });
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) throw new UnauthorizedException();

    if (!(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Your current password is incorrect.');
    }

    await this.repository.setPassword(userId, await this.passwords.hash(newPassword));
    await this.repository.revokeAllForUser(userId, 'password_changed');

    await this.audit.record({
      userId,
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: String(userId),
      newValues: { self: true },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  async loadUser(userId: number): Promise<AuthenticatedUser | null> {
    const user = await this.repository.findById(userId);
    if (!user || !user.isActive) return null;
    return this.toAuthenticatedUser(user);
  }

  toAuthenticatedUser(user: AuthUser): AuthenticatedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private async issueSession(
    user: AuthUser,
    familyId: string,
    context: { ip?: string; userAgent?: string },
  ): Promise<LoginResult & { refreshTokenId: number }> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, v: 1 } satisfies AccessTokenPayload,
      { secret: this.config.jwtAccessSecret, expiresIn: this.config.jwtAccessTtlSeconds },
    );

    const refreshToken = this.passwords.generateToken(48);
    const refreshExpiresAt = new Date(Date.now() + this.config.jwtRefreshTtlSeconds * 1000);

    const stored = await this.repository.createRefreshToken({
      userId: user.id,
      tokenHash: this.passwords.hashToken(refreshToken),
      familyId,
      expiresAt: refreshExpiresAt,
      ipAddress: context.ip,
      userAgent: context.userAgent?.slice(0, 255),
    });

    return {
      user: this.toAuthenticatedUser(user),
      accessToken,
      refreshToken,
      refreshExpiresAt,
      refreshTokenId: stored.id,
    };
  }
}
