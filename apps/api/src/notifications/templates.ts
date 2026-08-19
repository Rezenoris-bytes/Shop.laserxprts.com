/**
 * Email templates.
 *
 * Plain functions rather than a templating engine: there are five of them, they
 * change rarely, and a build step for five strings is not worth the dependency.
 *
 * Every template emits both HTML and text. Text is not optional — a text part
 * measurably improves deliverability, and corporate gateways of the kind LEI's
 * customers run often strip HTML entirely.
 */

export type TemplateName =
  'password-reset' | 'enquiry-confirmation' | 'enquiry-alert' | 'quote-sent' | 'contact-alert';

export type TemplateData = Record<string, string | number>;

export interface RenderContext {
  siteUrl: string;
  demoMode: boolean;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Escapes interpolated values — template data reaches these from public forms,
 * so it is never trusted. Accepts undefined because strict index access makes
 * every TemplateData lookup optional; a missing field renders as empty.
 */
function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(context: RenderContext, title: string, bodyHtml: string): string {
  const demoBanner = context.demoMode
    ? `<div style="background:#fff3cd;border:1px solid #ffe08a;color:#664d03;padding:10px 14px;
         border-radius:6px;font-size:13px;margin-bottom:20px">
         <strong>Demonstration environment.</strong> This message was generated from sample data
         and is not a real commercial communication.
       </div>`
    : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a18">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
    ${demoBanner}
    <div style="font-weight:700;font-size:17px;letter-spacing:-0.01em;margin-bottom:4px">Laser Experts India</div>
    <div style="color:#6b6b66;font-size:12px;margin-bottom:22px">Laser spares, consumables and technical services</div>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e7e5e0;margin:26px 0 14px">
    <div style="color:#8a8a83;font-size:11.5px;line-height:1.6">
      This is an automated message from ${esc(context.siteUrl)}.<br>
      If you did not expect it, you can safely ignore it.
    </div>
  </div>
</body></html>`;
}

const button = (url: string, label: string) =>
  `<p style="margin:22px 0">
     <a href="${esc(url)}" style="display:inline-block;background:#c96a1f;color:#fff;
        text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;font-size:14px">
        ${esc(label)}</a>
   </p>`;

export function renderTemplate(
  name: TemplateName,
  data: TemplateData,
  context: RenderContext,
): RenderedEmail {
  const prefix = context.demoMode ? '[SAMPLE] ' : '';

  switch (name) {
    case 'password-reset': {
      const url = String(data.resetUrl);
      return {
        subject: `${prefix}Reset your LEI admin password`,
        html: layout(
          context,
          'Reset your password',
          `<p style="font-size:15px;line-height:1.6">A password reset was requested for your LEI
             admin account. This link expires in 30 minutes and can be used once.</p>
           ${button(url, 'Set a new password')}
           <p style="color:#6b6b66;font-size:13px">If you did not request this, no action is
             needed — your password has not changed.</p>`,
        ),
        text:
          `A password reset was requested for your LEI admin account.\n\n` +
          `${url}\n\nThis link expires in 30 minutes and can be used once.\n` +
          `If you did not request it, no action is needed.`,
      };
    }

    case 'enquiry-confirmation': {
      return {
        subject: `${prefix}We have your request — ${esc(data.publicRef)}`,
        html: layout(
          context,
          'Request received',
          `<p style="font-size:15px;line-height:1.6">Hello ${esc(data.contactName)},</p>
           <p style="font-size:15px;line-height:1.6">Thank you — we have received your request for
             <strong>${esc(data.itemCount)} item(s)</strong>. Our team will review it and come back
             to you with a quotation, usually within one working day.</p>
           <p style="background:#faf9f7;border:1px solid #e7e5e0;border-radius:6px;padding:12px 14px;
              font-size:14px">Your reference: <strong style="font-family:ui-monospace,monospace">
              ${esc(data.publicRef)}</strong></p>
           <p style="color:#6b6b66;font-size:13px">Please quote this reference if you contact us
             about the request.</p>`,
        ),
        text:
          `Hello ${data.contactName},\n\n` +
          `Thank you — we have received your request for ${data.itemCount} item(s).\n` +
          `Our team will review it and come back to you with a quotation, usually within one working day.\n\n` +
          `Your reference: ${data.publicRef}\n\n` +
          `Please quote this reference if you contact us about the request.`,
      };
    }

    case 'enquiry-alert': {
      const url = String(data.adminUrl);
      return {
        subject: `${prefix}New quote request — ${esc(data.contactName)} (${esc(data.itemCount)} item(s))`,
        html: layout(
          context,
          'New quote request',
          `<p style="font-size:15px;line-height:1.6"><strong>New quote request received.</strong></p>
           <table style="font-size:14px;line-height:1.9;border-collapse:collapse">
             <tr><td style="color:#6b6b66;padding-right:16px">Reference</td><td><strong>${esc(data.publicRef)}</strong></td></tr>
             <tr><td style="color:#6b6b66;padding-right:16px">Contact</td><td>${esc(data.contactName)}</td></tr>
             <tr><td style="color:#6b6b66;padding-right:16px">Company</td><td>${esc(data.contactCompany || '—')}</td></tr>
             <tr><td style="color:#6b6b66;padding-right:16px">Phone</td><td>${esc(data.contactPhone || '—')}</td></tr>
             <tr><td style="color:#6b6b66;padding-right:16px">Items</td><td>${esc(data.itemCount)}</td></tr>
           </table>
           ${button(url, 'Open in admin')}`,
        ),
        text:
          `New quote request received.\n\n` +
          `Reference: ${data.publicRef}\nContact: ${data.contactName}\n` +
          `Company: ${data.contactCompany || '-'}\nPhone: ${data.contactPhone || '-'}\n` +
          `Items: ${data.itemCount}\n\nOpen in admin: ${url}`,
      };
    }

    case 'quote-sent': {
      const url = String(data.downloadUrl);
      const validity = data.validUntil
        ? `<p style="color:#6b6b66;font-size:13px">This quotation is valid until
             <strong>${esc(data.validUntil)}</strong>.</p>`
        : '';
      return {
        subject: `${prefix}Quotation ${esc(data.quoteNumber)} from Laser Experts India`,
        html: layout(
          context,
          'Your quotation',
          `<p style="font-size:15px;line-height:1.6">Hello ${esc(data.contactName)},</p>
           <p style="font-size:15px;line-height:1.6">Please find your quotation
             <strong>${esc(data.quoteNumber)}</strong> for
             <strong>${esc(data.total)}</strong> (inclusive of GST).</p>
           ${button(url, 'Download quotation (PDF)')}
           ${validity}
           <p style="color:#6b6b66;font-size:13px">The download link is personal to you and expires
             after 30 days. Reply to this email if you need anything adjusted.</p>`,
        ),
        text:
          `Hello ${data.contactName},\n\n` +
          `Please find your quotation ${data.quoteNumber} for ${data.total} (inclusive of GST).\n\n` +
          `Download: ${url}\n\n` +
          (data.validUntil ? `Valid until ${data.validUntil}.\n\n` : '') +
          `The link is personal to you and expires after 30 days.\n` +
          `Reply to this email if you need anything adjusted.`,
      };
    }

    case 'contact-alert': {
      return {
        subject: `${prefix}Contact form — ${esc(data.contactName)}`,
        html: layout(
          context,
          'Contact form submission',
          `<table style="font-size:14px;line-height:1.9;border-collapse:collapse">
             <tr><td style="color:#6b6b66;padding-right:16px">Name</td><td>${esc(data.contactName)}</td></tr>
             <tr><td style="color:#6b6b66;padding-right:16px">Email</td><td>${esc(data.contactEmail)}</td></tr>
             <tr><td style="color:#6b6b66;padding-right:16px">Phone</td><td>${esc(data.contactPhone || '—')}</td></tr>
           </table>
           <p style="font-size:14px;line-height:1.7;white-space:pre-wrap;background:#faf9f7;
              border:1px solid #e7e5e0;border-radius:6px;padding:12px 14px;margin-top:14px">${esc(data.message)}</p>`,
        ),
        text:
          `Contact form submission\n\nName: ${data.contactName}\nEmail: ${data.contactEmail}\n` +
          `Phone: ${data.contactPhone || '-'}\n\n${data.message}`,
      };
    }
  }
}
