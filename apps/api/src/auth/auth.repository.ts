import { Injectable } from '@nestjs/common';
import type { RefreshToken, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuthUser = User;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Users ─────────────────────────────────────────────────────────────

  async findByEmail(emailNormalized: string): Promise<AuthUser | null> {
    return this.prisma.client.user.findFirst({
      where: { emailNormalized, deletedAt: null },
    });
  }

  async findById(id: number): Promise<AuthUser | null> {
    return this.prisma.client.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async recordSuccessfulLogin(userId: number): Promise<void> {
    await this.prisma.raw.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
  }

  /**
   * Increments the failure counter and locks the account once it crosses the
   * threshold. Per-account locking pairs with the per-IP rate limit: one stops
   * a targeted attack on a known email, the other stops spraying.
   */
  async recordFailedLogin(
    userId: number,
    maxAttempts: number,
    lockMinutes: number,
  ): Promise<{ locked: boolean; attempts: number }> {
    const user = await this.prisma.raw.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });

    if (user.failedLoginCount >= maxAttempts) {
      await this.prisma.raw.user.update({
        where: { id: userId },
        data: {
          lockedUntil: new Date(Date.now() + lockMinutes * 60_000),
          failedLoginCount: 0,
        },
      });
      return { locked: true, attempts: user.failedLoginCount };
    }

    return { locked: false, attempts: user.failedLoginCount };
  }

  async setPassword(userId: number, passwordHash: string): Promise<void> {
    await this.prisma.raw.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  }

  // ── Refresh tokens ────────────────────────────────────────────────────

  async createRefreshToken(data: {
    userId: number;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<RefreshToken> {
    return this.prisma.raw.refreshToken.create({ data });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.raw.refreshToken.findUnique({ where: { tokenHash } });
  }

  /** Rotation: mark the old token used and point it at its replacement. */
  async rotateRefreshToken(oldId: number, newId: number): Promise<void> {
    await this.prisma.raw.refreshToken.update({
      where: { id: oldId },
      data: { revokedAt: new Date(), revokedReason: 'rotated', replacedById: newId },
    });
  }

  /**
   * Revokes an entire token family.
   *
   * Called when a token that was already rotated is presented again — which
   * means either the user's token was stolen and replayed, or ours was. Either
   * way the whole session is no longer trustworthy, so every token in the
   * family dies and the user must log in again.
   */
  async revokeFamily(familyId: string, reason: string): Promise<number> {
    const result = await this.prisma.raw.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  async revokeAllForUser(userId: number, reason: string): Promise<number> {
    const result = await this.prisma.raw.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await this.prisma.raw.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  // ── Password resets ───────────────────────────────────────────────────

  async createPasswordReset(data: {
    userId: number;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.raw.passwordResetToken.create({ data });
  }

  async findPasswordReset(tokenHash: string) {
    return this.prisma.raw.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async consumePasswordReset(id: number): Promise<void> {
    await this.prisma.raw.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async invalidateUserResets(userId: number): Promise<void> {
    await this.prisma.raw.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
