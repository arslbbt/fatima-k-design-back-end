import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mailjet from 'node-mailjet';
import {
  IMailService,
  AppointmentEmailContext,
  PaymentEmailContext,
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
    return date.toLocaleString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      accentColor: '#b8860b',
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
      accentColor: '#b8860b',
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
      accentColor: '#8b6914',
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
      accentColor: '#888',
    });
    await this.send(
      { email: ctx.brideEmail, name: ctx.brideName },
      subject,
      html,
      this.buildIcsAttachment(ctx),
    );
  }

  async sendPaymentRequest(
    ctx: import('./mail.interface').PaymentEmailContext,
  ): Promise<void> {
    const amount = `$${Number(ctx.amount).toLocaleString()}`;
    const due = ctx.dueDate
      ? ctx.dueDate.toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;
    const subject = `Payment Request: ${ctx.label} — Fatima K Design`;
    const html = this.buildPaymentEmail({
      heading: 'Payment Request',
      intro: `Hi ${ctx.brideName}, a payment of <strong>${amount}</strong> has been added to your account.`,
      label: ctx.label,
      amount,
      due,
      notes: null,
    });
    await this.send(
      { email: ctx.brideEmail, name: ctx.brideName },
      subject,
      html,
    );
  }

  async sendPaymentReminder(
    ctx: import('./mail.interface').PaymentEmailContext,
  ): Promise<void> {
    const amount = `$${Number(ctx.amount).toLocaleString()}`;
    const due = ctx.dueDate
      ? ctx.dueDate.toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;
    const subject = `Payment Reminder: ${ctx.label} Due — Fatima K Design`;
    const html = this.buildPaymentEmail({
      heading: 'Payment Reminder',
      intro: `Hi ${ctx.brideName}, this is a friendly reminder that your payment of <strong>${amount}</strong> is due${due ? ` on <strong>${due}</strong>` : ''}.`,
      label: ctx.label,
      amount,
      due,
      notes: null,
    });
    await this.send(
      { email: ctx.brideEmail, name: ctx.brideName },
      subject,
      html,
    );
  }

  private buildPaymentEmail(opts: {
    heading: string;
    intro: string;
    label: string;
    amount: string;
    due: string | null;
    notes: string | null;
  }): string {
    const { heading, intro, label, amount, due, notes } = opts;
    return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#faf9f7;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;">
  <tr><td style="background:#b8860b;padding:32px 40px;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:normal;letter-spacing:2px;">FATIMA K DESIGN</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 16px;color:#2c2c2c;font-size:20px;font-weight:normal;">${heading}</h2>
    <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">${intro}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7;border-left:3px solid #b8860b;margin-bottom:24px;">
      <tr><td style="padding:8px 20px;"><p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Payment Type</p>
        <p style="margin:4px 0 0;color:#2c2c2c;font-size:15px;">${label}</p></td></tr>
      <tr><td style="padding:8px 20px;"><p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Amount</p>
        <p style="margin:4px 0 0;color:#2c2c2c;font-size:15px;">${amount}</p></td></tr>
      ${
        due
          ? `<tr><td style="padding:8px 20px;"><p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Due Date</p>
        <p style="margin:4px 0 0;color:#2c2c2c;font-size:15px;">${due}</p></td></tr>`
          : ''
      }
      ${
        notes
          ? `<tr><td style="padding:8px 20px;"><p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Notes</p>
        <p style="margin:4px 0 0;color:#2c2c2c;font-size:15px;">${notes}</p></td></tr>`
          : ''
      }
    </table>
    <p style="margin:0;color:#aaa;font-size:13px;">If you have any questions, please contact us directly.</p>
  </td></tr>
  <tr><td style="background:#faf9f7;padding:20px 40px;text-align:center;">
    <p style="margin:0;color:#bbb;font-size:12px;">© Fatima K Design — All rights reserved</p>
  </td></tr>
</table></td></tr></table></body></html>`;
  }

  private buildAppointmentEmail(opts: {
    heading: string;
    intro: string;
    ctx: AppointmentEmailContext;
    accentColor: string;
  }): string {
    const { heading, intro, ctx, accentColor } = opts;
    const showCalendarButton = ctx.ics && ctx.ics.method === 'REQUEST';
    const googleCalLink = showCalendarButton
      ? this.buildGoogleCalendarLink(ctx)
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:0;background:#faf9f7;font-family:Georgia,serif;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:40px 20px;">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;">
                  <tr>
                    <td style="background:${accentColor};padding:32px 40px;">
                      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:normal;letter-spacing:2px;">
                        FATIMA K DESIGN
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px;">
                      <h2 style="margin:0 0 16px;color:#2c2c2c;font-size:20px;font-weight:normal;">
                        ${heading}
                      </h2>
                      <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                        ${intro}
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0"
                        style="background:#faf9f7;border-left:3px solid ${accentColor};padding:20px;margin-bottom:24px;">
                        <tr>
                          <td style="padding:6px 20px;">
                            <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Type</p>
                            <p style="margin:4px 0 0;color:#2c2c2c;font-size:15px;">${ctx.title}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:6px 20px;">
                            <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Date & Time</p>
                            <p style="margin:4px 0 0;color:#2c2c2c;font-size:15px;">${this.formatDateTime(ctx.startTime)}</p>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0;color:#aaa;font-size:13px;">
                        If you have any questions, please reply to this email or contact us directly.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }
}
