import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mailjet from 'node-mailjet';
import {
  IMailService,
  AppointmentEmailContext,
  PaymentEmailContext,
  PaymentReminderContext,
} from './mail.interface';
import { IcsService } from '../ics/ics.service';

@Injectable()
export class MailjetService implements IMailService {
  private readonly client: Mailjet;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly logger = new Logger(MailjetService.name);

  constructor(
    private config: ConfigService,
    private ics: IcsService,
  ) {
    this.client = new Mailjet({
      apiKey: this.config.get<string>('mailjet.apiKey'),
      apiSecret: this.config.get<string>('mailjet.secretKey'),
    });
    this.fromEmail = this.config.get<string>('mailjet.fromEmail') ?? '';
    this.fromName =
      this.config.get<string>('mailjet.fromName') ?? 'Fatima K Design';
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Australia/Sydney',
    });
  }

  private toGoogleCalendarDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  private buildGoogleCalendarLink(ctx: AppointmentEmailContext): string {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${ctx.title} — Fatima K Design`,
      dates: `${this.toGoogleCalendarDate(ctx.startTime)}/${this.toGoogleCalendarDate(ctx.endTime)}`,
      details: ctx.whatToBring ? `What to bring: ${ctx.whatToBring}` : '',
      location: ctx.location ?? '',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  private buildIcsAttachment(ctx: AppointmentEmailContext): object | null {
    if (!ctx.ics) return null;

    const icsContent = this.ics.generate({
      uid: ctx.ics.uid,
      sequence: ctx.ics.sequence,
      method: ctx.ics.method,
      summary: `${ctx.title} — Fatima K Design`,
      description: ctx.whatToBring
        ? `What to bring: ${ctx.whatToBring}`
        : undefined,
      location: ctx.location ?? undefined,
      startTime: ctx.startTime,
      endTime: ctx.endTime,
      organizerEmail: this.fromEmail,
      organizerName: this.fromName,
      attendeeEmail: ctx.brideEmail,
      attendeeName: ctx.brideName,
    });

    return {
      ContentType: `text/calendar; method=${ctx.ics.method}`,
      Filename: 'appointment.ics',
      Base64Content: Buffer.from(icsContent).toString('base64'),
    };
  }

  private async send(
    to: { email: string; name: string },
    subject: string,
    htmlContent: string,
    attachment?: object | null,
  ): Promise<void> {
    try {
      const message: Record<string, unknown> = {
        From: { Email: this.fromEmail, Name: this.fromName },
        To: [{ Email: to.email, Name: to.name }],
        Subject: subject,
        HTMLPart: htmlContent,
      };

      if (attachment) {
        message.Attachments = [attachment];
      }

      await this.client
        .post('send', { version: 'v3.1' })
        .request({ Messages: [message] });
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to.email}`);
      this.logger.error(`Status: ${err?.statusCode ?? err?.status}`);
      this.logger.error(
        `Response: ${JSON.stringify(err?.response?.data ?? err?.message)}`,
      );
      throw err;
    }
  }

  async sendAppointmentConfirmation(
    ctx: AppointmentEmailContext,
  ): Promise<void> {
    const subject = `Your ${ctx.title} appointment is confirmed — Fatima K Design`;
    const html = this.buildAppointmentEmail({
      heading: 'Appointment Confirmed',
      intro: `Hi ${ctx.brideName}, your appointment has been confirmed. You'll find a calendar invite attached.`,
      ctx,
    });
    await this.send(
      { email: ctx.brideEmail, name: ctx.brideName },
      subject,
      html,
      this.buildIcsAttachment(ctx),
    );
  }

  async sendAppointmentUpdate(ctx: AppointmentEmailContext): Promise<void> {
    const subject = `Your ${ctx.title} appointment has been updated — Fatima K Design`;
    const html = this.buildAppointmentEmail({
      heading: 'Appointment Updated',
      intro: `Hi ${ctx.brideName}, your appointment details have been updated. The attached calendar invite will update your existing event.`,
      ctx,
    });
    await this.send(
      { email: ctx.brideEmail, name: ctx.brideName },
      subject,
      html,
      this.buildIcsAttachment(ctx),
    );
  }

  async sendAppointmentReminder(ctx: AppointmentEmailContext): Promise<void> {
    const subject = `Reminder: Your ${ctx.title} is tomorrow — Fatima K Design`;
    const html = this.buildAppointmentEmail({
      heading: 'Appointment Reminder',
      intro: `Hi ${ctx.brideName}, just a reminder that your appointment is in 48 hours.`,
      ctx,
    });
    // No ICS on reminders — event is already in their calendar
    await this.send(
      { email: ctx.brideEmail, name: ctx.brideName },
      subject,
      html,
    );
  }

  async sendAppointmentCancellation(
    ctx: AppointmentEmailContext,
  ): Promise<void> {
    const subject = `Appointment Cancelled — Fatima K Design`;
    const html = this.buildAppointmentEmail({
      heading: 'Appointment Cancelled',
      intro: `Hi ${ctx.brideName}, your appointment has been cancelled. Please contact us to reschedule.`,
      ctx,
    });
    await this.send(
      { email: ctx.brideEmail, name: ctx.brideName },
      subject,
      html,
      this.buildIcsAttachment(ctx),
    );
  }

  async sendPaymentRequest(ctx: PaymentEmailContext): Promise<void> {
    const amount = Number(ctx.amount);
    const subject = `Payment Request: ${ctx.label} — Fatima K Design`;
    const html = this.buildPaymentRequestEmail({
      brideName: ctx.brideName,
      label: ctx.label,
      amount,
      dueDate: ctx.dueDate,
      paymentUrl: ctx.paymentUrl,
    });
    await this.send(
      { email: ctx.brideEmail, name: ctx.brideName },
      subject,
      html,
    );
  }

  async sendPaymentReminder(ctx: PaymentReminderContext): Promise<void> {
    const totalAmount = ctx.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const subject = `Payment Reminder: ${ctx.payments.length} Payment${ctx.payments.length > 1 ? 's' : ''} Due — Fatima K Design`;

    const paymentsHtml = ctx.payments
      .map((p) => {
        const amount = Number(p.amount);
        return `
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #F0EBE4;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:70%;">
                <p style="margin:0 0 4px;color:#2C2C2C;font-size:15px;font-weight:600;">${p.label}</p>
                <p style="margin:0;color:#888;font-size:13px;">Due: ${p.dueDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' })}</p>
              </td>
              <td style="width:30%;text-align:right;">
                <p style="margin:0;color:#D4A373;font-size:18px;font-weight:600;">$${amount.toLocaleString()}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#D4A373,#C8956A);padding:40px 32px;text-align:center;">
            <h1 style="margin:0;color:#FFFFFF;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:500;letter-spacing:1px;">FATIMA K DESIGN</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;">
            <h2 style="margin:0 0 16px;color:#2C2C2C;font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:500;">Payment Reminder</h2>
            <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">Hi ${ctx.brideName},</p>
            <p style="margin:0 0 32px;color:#555;font-size:15px;line-height:1.6;">This is a friendly reminder that you have ${ctx.payments.length} pending payment${ctx.payments.length > 1 ? 's' : ''}. Please review the details below:</p>
            
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFBF9;border:1px solid #E8E0D5;border-radius:8px;margin-bottom:32px;overflow:hidden;">
              ${paymentsHtml}
              <tr>
                <td style="padding:20px;background:#F5EFE9;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:70%;">
                        <p style="margin:0;color:#2C2C2C;font-size:16px;font-weight:600;">Total Due</p>
                      </td>
                      <td style="width:30%;text-align:right;">
                        <p style="margin:0;color:#D4A373;font-size:22px;font-weight:700;">$${totalAmount.toLocaleString()}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 0 24px;">
                  <a href="${ctx.paymentUrl}" style="display:inline-block;padding:14px 32px;background:#2C2C2C;color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">View Payment Details</a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">If you have any questions or need to discuss payment arrangements, please don't hesitate to contact us.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#FAF8F5;padding:24px 32px;text-align:center;border-top:1px solid #E8E0D5;">
            <p style="margin:0 0 8px;color:#A67C52;font-size:13px;font-weight:500;">Fatima K Design</p>
            <p style="margin:0;color:#AAAAAA;font-size:12px;">© ${new Date().getFullYear()} All rights reserved</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    await this.send(
      { email: ctx.brideEmail, name: ctx.brideName },
      subject,
      html,
    );
  }

  async sendWelcomeEmail(
    brideName: string,
    brideEmail: string,
    temporaryPassword: string,
  ): Promise<void> {
    const portalUrl = this.config.get<string>('frontend.url');
    const subject = 'Welcome to Fatima K Design — Your Portal Access';

    const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#D4A373,#C8956A);padding:40px 32px;text-align:center;">
            <h1 style="margin:0;color:#FFFFFF;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:500;letter-spacing:1px;">FATIMA K DESIGN</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;">
            <h2 style="margin:0 0 16px;color:#2C2C2C;font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:500;">Welcome to Your Bridal Portal</h2>
            <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">Hi ${brideName},</p>
            <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">We're thrilled to have you! Your personal bridal portal has been created where you can track your journey, view appointments, manage payments, and share inspiration.</p>
            
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFBF9;border:1px solid #E8E0D5;border-radius:8px;margin-bottom:32px;overflow:hidden;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 12px;color:#A67C52;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your Login Credentials</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:8px 0;">
                        <p style="margin:0;color:#888;font-size:12px;">Email</p>
                        <p style="margin:4px 0 0;color:#2C2C2C;font-size:15px;font-weight:600;">${brideEmail}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <p style="margin:0;color:#888;font-size:12px;">Temporary Password</p>
                        <p style="margin:4px 0 0;color:#2C2C2C;font-size:15px;font-weight:600;font-family:monospace;background:#F5EFE9;padding:8px 12px;border-radius:6px;display:inline-block;">${temporaryPassword}</p>
                      </td>
                    </tr>
                  </table>
                  <div style="margin-top:16px;padding:12px;background:#FFF9F4;border-left:3px solid #D4A373;border-radius:4px;">
                    <p style="margin:0;color:#C07840;font-size:13px;line-height:1.5;">
                      <strong>Important:</strong> Please change your password after your first login for security.
                    </p>
                  </div>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 0 24px;">
                  <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background:#2C2C2C;color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Access Your Portal</a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">If you have any questions or need assistance, please don't hesitate to reach out. We're here to make your bridal journey unforgettable.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#FAF8F5;padding:24px 32px;text-align:center;border-top:1px solid #E8E0D5;">
            <p style="margin:0 0 8px;color:#A67C52;font-size:13px;font-weight:500;">Fatima K Design</p>
            <p style="margin:0;color:#AAAAAA;font-size:12px;">© ${new Date().getFullYear()} All rights reserved</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    await this.send({ email: brideEmail, name: brideName }, subject, html);
  }

  private buildPaymentRequestEmail(opts: {
    brideName: string;
    label: string;
    amount: number;
    dueDate: Date | null;
    paymentUrl: string;
  }): string {
    const { brideName, label, amount, dueDate, paymentUrl } = opts;
    const dueDateStr = dueDate
      ? dueDate.toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'Australia/Sydney',
        })
      : 'No due date specified';

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#D4A373,#C8956A);padding:40px 32px;text-align:center;">
            <h1 style="margin:0;color:#FFFFFF;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:500;letter-spacing:1px;">FATIMA K DESIGN</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;">
            <h2 style="margin:0 0 16px;color:#2C2C2C;font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:500;">Payment Request</h2>
            <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">Hi ${brideName},</p>
            <p style="margin:0 0 32px;color:#555;font-size:15px;line-height:1.6;">A new payment has been added to your account. Please review the details below:</p>
            
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFBF9;border:1px solid #E8E0D5;border-radius:8px;margin-bottom:32px;overflow:hidden;">
              <tr>
                <td style="padding:24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid #F0EBE4;">
                        <p style="margin:0;color:#888;font-size:12px;">Payment Type</p>
                        <p style="margin:4px 0 0;color:#2C2C2C;font-size:15px;font-weight:600;">${label}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid #F0EBE4;">
                        <p style="margin:0;color:#888;font-size:12px;">Amount</p>
                        <p style="margin:4px 0 0;color:#D4A373;font-size:22px;font-weight:700;">$${amount.toLocaleString()}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 0;">
                        <p style="margin:0;color:#888;font-size:12px;">Due Date</p>
                        <p style="margin:4px 0 0;color:#2C2C2C;font-size:15px;font-weight:600;">${dueDateStr}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 0 24px;">
                  <a href="${paymentUrl}" style="display:inline-block;padding:14px 32px;background:#2C2C2C;color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">View Payment Details</a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">If you have any questions about this payment, please don't hesitate to contact us.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#FAF8F5;padding:24px 32px;text-align:center;border-top:1px solid #E8E0D5;">
            <p style="margin:0 0 8px;color:#A67C52;font-size:13px;font-weight:500;">Fatima K Design</p>
            <p style="margin:0;color:#AAAAAA;font-size:12px;">© ${new Date().getFullYear()} All rights reserved</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
  }

  private buildAppointmentEmail(opts: {
    heading: string;
    intro: string;
    ctx: AppointmentEmailContext;
  }): string {
    const { heading, intro, ctx } = opts;

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#D4A373,#C8956A);padding:40px 32px;text-align:center;">
            <h1 style="margin:0;color:#FFFFFF;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:500;letter-spacing:1px;">FATIMA K DESIGN</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;">
            <h2 style="margin:0 0 16px;color:#2C2C2C;font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:500;">${heading}</h2>
            <p style="margin:0 0 32px;color:#555;font-size:15px;line-height:1.6;">${intro}</p>
            
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFBF9;border:1px solid #E8E0D5;border-radius:8px;margin-bottom:32px;overflow:hidden;">
              <tr>
                <td style="padding:24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid #F0EBE4;">
                        <p style="margin:0;color:#888;font-size:12px;">Appointment Type</p>
                        <p style="margin:4px 0 0;color:#2C2C2C;font-size:15px;font-weight:600;">${ctx.title}</p>
                      </td>
                    </tr>
                    ${
                      ctx.description
                        ? `<tr>
                      <td style="padding:12px 0;border-bottom:1px solid #F0EBE4;">
                        <p style="margin:0;color:#888;font-size:12px;">Description</p>
                        <p style="margin:4px 0 0;color:#2C2C2C;font-size:15px;line-height:1.5;">${ctx.description}</p>
                      </td>
                    </tr>`
                        : ''
                    }
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid #F0EBE4;">
                        <p style="margin:0;color:#888;font-size:12px;">Date & Time</p>
                        <p style="margin:4px 0 0;color:#2C2C2C;font-size:15px;font-weight:600;">${this.formatDateTime(ctx.startTime)}</p>
                      </td>
                    </tr>
                    ${
                      ctx.location
                        ? `<tr>
                      <td style="padding:12px 0;border-bottom:1px solid #F0EBE4;">
                        <p style="margin:0;color:#888;font-size:12px;">Location</p>
                        <p style="margin:4px 0 0;color:#2C2C2C;font-size:15px;font-weight:600;">${ctx.location}</p>
                      </td>
                    </tr>`
                        : ''
                    }
                    ${
                      ctx.whatToBring
                        ? `<tr>
                      <td style="padding:12px 0;">
                        <p style="margin:0;color:#888;font-size:12px;">What to Bring</p>
                        <p style="margin:4px 0 0;color:#2C2C2C;font-size:15px;font-weight:600;">${ctx.whatToBring}</p>
                      </td>
                    </tr>`
                        : ''
                    }
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">If you have any questions, please reply to this email or contact us directly.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#FAF8F5;padding:24px 32px;text-align:center;border-top:1px solid #E8E0D5;">
            <p style="margin:0 0 8px;color:#A67C52;font-size:13px;font-weight:500;">Fatima K Design</p>
            <p style="margin:0;color:#AAAAAA;font-size:12px;">© ${new Date().getFullYear()} All rights reserved</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
  }
}
