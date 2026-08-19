import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  changePasswordSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  type ChangePasswordInput,
  type LoginInput,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
} from '@lei/shared';
import { Authenticated, Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Client, type ClientContext } from '../common/decorators/client-context.decorator';
import { ZodBody } from '../common/pipes/zod-validation.pipe';
import { AppConfigService } from '../config/app-config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService, type AuthenticatedUser } from './auth.service';

const REFRESH_COOKIE = 'lei_rt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(ZodBody(loginSchema)) body: LoginInput,
    @Client() client: ClientContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.login(body.email, body.password, client);
    this.setRefreshCookie(reply, result.refreshToken, result.refreshExpiresAt);

    // The access token is returned in the body and held in memory by the
    // client. It is deliberately NOT a cookie — see JwtAuthGuard.
    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: this.config.jwtAccessTtlSeconds,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: FastifyRequest,
    @Client() client: ClientContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const token = request.cookies?.[REFRESH_COOKIE];
    const result = await this.auth.refresh(token ?? '', client);
    this.setRefreshCookie(reply, result.refreshToken, result.refreshExpiresAt);

    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: this.config.jwtAccessTtlSeconds,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: FastifyRequest,
    @Client() client: ClientContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.logout(request.cookies?.[REFRESH_COOKIE], client);
    void reply.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { success: true };
  }

  @Get('me')
  @Authenticated()
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestReset(@Body(ZodBody(passwordResetRequestSchema)) body: PasswordResetRequestInput) {
    const result = await this.auth.requestPasswordReset(body.email);

    if (result) {
      await this.notifications.sendPasswordReset(body.email, result.token);
    }

    // Always the same response. Telling the caller whether the account exists
    // would leak exactly what the login form is careful not to.
    return {
      success: true,
      message: 'If that email is registered, a reset link has been sent.',
    };
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmReset(@Body(ZodBody(passwordResetConfirmSchema)) body: PasswordResetConfirmInput) {
    await this.auth.confirmPasswordReset(body.token, body.password);
    return { success: true, message: 'Password updated. Please sign in.' };
  }

  @Post('change-password')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(ZodBody(changePasswordSchema)) body: ChangePasswordInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.changePassword(user.id, body.currentPassword, body.password);

    // Every session is revoked, including this one.
    void reply.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { success: true, message: 'Password changed. Please sign in again.' };
  }

  private setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
    void reply.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.isProduction,
      // Strict rather than Lax: the refresh endpoint is the one cookie-borne
      // credential in the system, so it should never ride a cross-site request.
      sameSite: 'strict',
      domain: this.config.cookieDomain,
      path: '/',
      expires: expiresAt,
    });
  }
}
