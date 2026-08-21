import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { normalizeEmail, normalizePhone, type QuoteRequestInput } from '@lei/shared';
import { PasswordService } from '../auth/password.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@lei/shared';
import { EnquiriesRepository } from './enquiries.repository';

const CONSENT_TEXT =
  'I agree that Laser Experts India may use the details I have provided to respond to this ' +
  'request and to contact me about it.';

/** Submissions faster than this are automated, not human. */
const MIN_FORM_SECONDS = 2;

@Injectable()
export class EnquiriesService {
  private readonly logger = new Logger(EnquiriesService.name);

  constructor(
    private readonly repository: EnquiriesRepository,
    private readonly passwords: PasswordService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Submits a Quote Request.
   *
   * Order matters: the enquiry is committed FIRST, then emails are queued. A
   * mail provider outage must never lose a lead — that is the whole point of
   * the system.
   */
  async submit(
    input: QuoteRequestInput,
    context: { ip?: string; userAgent?: string },
  ): Promise<{ publicRef: string; itemCount: number }> {
    const spamScore = this.scoreSpam(input);

    // A filled honeypot is unambiguous: the field is invisible to humans.
    if (input.website) {
      this.logger.warn(`Honeypot triggered from ${context.ip ?? 'unknown'} — discarding silently`);
      // Return a plausible success so the bot does not learn it was detected.
      return { publicRef: this.passwords.generatePublicRef(), itemCount: input.items.length };
    }

    if (input.items.length === 0) {
      throw new BadRequestException('Add at least one item to your request');
    }

    const result = await this.repository.createEnquiry({
      publicRef: this.passwords.generatePublicRef(),
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      contactCompany: input.contactCompany,
      contactCity: input.contactCity,
      message: input.message,
      machineBrandId: input.machineBrandId,
      machineModelId: input.machineModelId,
      machineVariantId: input.machineVariantId,
      consentText: CONSENT_TEXT,
      ipAddress: context.ip,
      userAgent: context.userAgent,
      spamScore,
      items: input.items,
    });

    await this.audit.record({
      action: AuditAction.CREATE,
      entityType: 'Enquiry',
      entityId: String(result.enquiry.id),
      ipAddress: context.ip,
      newValues: { status: 'NEW', itemCount: result.itemCount },
    });

    // Fire and forget — failures are logged to email_logs, never surfaced to
    // the customer, and never roll back the saved enquiry.
    void this.dispatchNotifications(result);

    return { publicRef: result.enquiry.publicRef, itemCount: result.itemCount };
  }

  private async dispatchNotifications(result: {
    enquiry: {
      id: number;
      publicRef: string;
      contactName: string;
      contactEmail: string | null;
      contactCompany: string | null;
      contactPhone: string | null;
    };
    itemCount: number;
  }): Promise<void> {
    try {
      if (result.enquiry.contactEmail) {
        await this.notifications.sendEnquiryConfirmation({
          to: result.enquiry.contactEmail,
          contactName: result.enquiry.contactName,
          publicRef: result.enquiry.publicRef,
          itemCount: result.itemCount,
          enquiryId: result.enquiry.id,
        });
      }

      const recipients = await this.settings.salesNotificationRecipients();
      if (recipients.length > 0) {
        await this.notifications.sendEnquiryAlert({
          recipients,
          publicRef: result.enquiry.publicRef,
          contactName: result.enquiry.contactName,
          contactCompany: result.enquiry.contactCompany,
          contactPhone: result.enquiry.contactPhone,
          itemCount: result.itemCount,
          enquiryId: result.enquiry.id,
        });
      } else {
        this.logger.warn(
          'No sales notification recipients configured — new enquiries will go unnoticed. ' +
            'Set notify.sales_emails.',
        );
      }
    } catch (error) {
      this.logger.error(`Enquiry notifications failed: ${(error as Error).message}`);
    }
  }

  /**
   * Cheap heuristics, recorded rather than enforced.
   *
   * A public lead-generation form will be scraped and spammed; the point is to
   * let sales sort real from junk, not to block borderline cases and lose a
   * genuine enquiry.
   */
  private scoreSpam(input: QuoteRequestInput): number {
    let score = 0;

    if (input.elapsedMs !== undefined && input.elapsedMs < MIN_FORM_SECONDS * 1000) score += 40;
    if (input.message && /https?:\/\//i.test(input.message)) score += 30;
    if (input.message && /\b(seo|backlink|crypto|casino|loan)\b/i.test(input.message)) score += 30;
    if (input.contactName.length < 3) score += 10;
    if (!input.contactPhone && !input.contactCompany) score += 5;

    return Math.min(score, 100);
  }

  // ── Admin ─────────────────────────────────────────────────────────────

  async list(params: { page: number; perPage: number; status?: string; search?: string }) {
    const { items, total } = await this.repository.list({
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
      status: params.status as never,
      search: params.search,
    });

    const totalPages = Math.max(1, Math.ceil(total / params.perPage));
    return {
      data: items,
      meta: {
        pagination: {
          page: params.page,
          perPage: params.perPage,
          total,
          totalPages,
          hasNext: params.page < totalPages,
          hasPrev: params.page > 1,
        },
      },
    };
  }

  async get(id: number) {
    const enquiry = await this.repository.findById(id);
    if (!enquiry) throw new NotFoundException('Enquiry not found');
    return enquiry;
  }

  async update(
    id: number,
    changes: { status?: string; priority?: string; assignedToId?: number | null },
    actorId: number,
    context: { ip?: string },
  ) {
    const before = await this.repository.findById(id);
    if (!before) throw new NotFoundException('Enquiry not found');

    const updated = await this.repository.update(id, {
      ...(changes.status ? { status: changes.status as never } : {}),
      ...(changes.priority ? { priority: changes.priority as never } : {}),
      ...(changes.assignedToId !== undefined ? { assignedToId: changes.assignedToId } : {}),
      ...(changes.status === 'ACKNOWLEDGED' && !before.acknowledgedAt
        ? { acknowledgedAt: new Date() }
        : {}),
    });

    const diff = this.audit.diff(
      { status: before.status, priority: before.priority, assignedToId: before.assignedToId },
      { status: updated.status, priority: updated.priority, assignedToId: updated.assignedToId },
    );

    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Enquiry',
      entityId: String(id),
      oldValues: diff.oldValues,
      newValues: diff.newValues,
      ipAddress: context.ip,
    });

    return updated;
  }

  async checkDuplicate(email?: string, phone?: string) {
    return this.repository.findPossibleDuplicate(
      email ? normalizeEmail(email) : null,
      phone ? normalizePhone(phone) : null,
    );
  }
}
