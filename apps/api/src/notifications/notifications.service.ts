import { Injectable, Logger } from '@nestjs/common';
import { EmailStatus } from '@lei/shared';
import { AppConfigService } from '../config/app-config.service';
import { DemoModeService } from '../demo/demo-mode.service';
import { NotificationsRepository } from './notifications.repository';
import { renderTemplate, type TemplateName, type TemplateData } from './templates';

export interface SendOptions {
  to: string;
  template: TemplateName;
  data: TemplateData;
  entityType?: string;
  entityId?: string;
}

/**
 * Transactional email.
 *
 * Provider-abstracted so switching from Brevo costs a config change, not a
 * rewrite. Every send is logged to `email_logs` before it leaves, because
 * without delivery visibility sales believes a quote arrived when it bounced.
 *
 * Deliberate design decision: quote PDFs are NOT attached. Attachments are
 * stripped or spam-scored by many corporate mail gateways, which is exactly the
 * audience LEI sells to. The email carries a signed, expiring link instead.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly demo: DemoModeService,
    private readonly repository: NotificationsRepository,
  ) {}

  async send(options: SendOptions): Promise<boolean> {
    const rendered = renderTemplate(options.template, options.data, {
      siteUrl: this.config.siteUrl,
      demoMode: this.demo.enabled,
    });

    const log = await this.repository.create({
      toEmail: options.to,
      template: options.template,
      subject: rendered.subject,
      status: EmailStatus.QUEUED,
      entityType: options.entityType ?? null,
      entityId: options.entityId ?? null,
    });

    // In demo mode a seeded customer record must never receive real email.
    if (!this.demo.canSendEmailTo(options.to)) {
      await this.repository.markStatus(log.id, EmailStatus.FAILED, {
        errorMessage: 'Blocked by DEMO_MODE allowlist',
      });
      this.logger.warn(
        `DEMO_MODE: suppressed "${rendered.subject}" to ${options.to} (not in MAIL_DEMO_ALLOWLIST)`,
      );
      return false;
    }

    try {
      const providerId = await this.dispatch(
        options.to,
        rendered.subject,
        rendered.html,
        rendered.text,
      );
      await this.repository.markStatus(log.id, EmailStatus.SENT, {
        providerId,
        sentAt: new Date(),
      });
      return true;
    } catch (error) {
      const message = (error as Error).message;
      await this.repository.markStatus(log.id, EmailStatus.FAILED, { errorMessage: message });
      this.logger.error(`Email send failed to ${options.to}: ${message}`);
      // Never rethrow. An enquiry is saved before its emails are queued, so a
      // mail outage must not lose the lead.
      return false;
    }
  }

  private async dispatch(to: string, subject: string, html: string, text: string): Promise<string> {
    if (this.config.mailProvider === 'console') {
      this.logger.log(
        `\n--- EMAIL (console provider) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n--- end ---\n`,
      );
      return `console-${Date.now()}`;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.config.mailApiKey ?? '',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.config.mailFromAddress, name: this.config.mailFromName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Brevo responded ${response.status}: ${await response.text()}`);
    }

    const body = (await response.json()) as { messageId?: string };
    return body.messageId ?? 'unknown';
  }

  // ── Named sends ───────────────────────────────────────────────────────

  async sendPasswordReset(to: string, token: string): Promise<void> {
    await this.send({
      to,
      template: 'password-reset',
      data: { resetUrl: `${this.config.siteUrl}/admin/reset-password?token=${token}` },
    });
  }

  async sendEnquiryConfirmation(params: {
    to: string;
    contactName: string;
    publicRef: string;
    itemCount: number;
    enquiryId: number;
  }): Promise<void> {
    await this.send({
      to: params.to,
      template: 'enquiry-confirmation',
      data: {
        contactName: params.contactName,
        publicRef: params.publicRef,
        itemCount: params.itemCount,
      },
      entityType: 'Enquiry',
      entityId: String(params.enquiryId),
    });
  }

  async sendEnquiryAlert(params: {
    recipients: string[];
    publicRef: string;
    contactName: string;
    contactCompany?: string | null;
    contactPhone?: string | null;
    itemCount: number;
    enquiryId: number;
  }): Promise<void> {
    for (const to of params.recipients) {
      await this.send({
        to,
        template: 'enquiry-alert',
        data: {
          publicRef: params.publicRef,
          contactName: params.contactName,
          contactCompany: params.contactCompany ?? '',
          contactPhone: params.contactPhone ?? '',
          itemCount: params.itemCount,
          adminUrl: `${this.config.siteUrl}/admin/enquiries/${params.enquiryId}`,
        },
        entityType: 'Enquiry',
        entityId: String(params.enquiryId),
      });
    }
  }

  async sendQuote(params: {
    to: string;
    contactName: string;
    quoteNumber: string;
    total: string;
    validUntil?: string;
    downloadUrl: string;
    quoteId: number;
  }): Promise<boolean> {
    return this.send({
      to: params.to,
      template: 'quote-sent',
      data: {
        contactName: params.contactName,
        quoteNumber: params.quoteNumber,
        total: params.total,
        validUntil: params.validUntil ?? '',
        downloadUrl: params.downloadUrl,
      },
      entityType: 'Quote',
      entityId: String(params.quoteId),
    });
  }
}
