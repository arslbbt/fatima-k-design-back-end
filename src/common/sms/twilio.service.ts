import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import {
  ISmsService,
  AppointmentSmsContext,
  PaymentSmsContext,
  PaymentReminderSmsContext,
} from './sms.interface';

@Injectable()
export class TwilioService implements ISmsService {
  private readonly client: Twilio;
  private readonly fromPhone: string;
  private readonly logger = new Logger(TwilioService.name);

  constructor(private config: ConfigService) {
    const accountSid = this.config.get<string>('twilio.accountSid');
    const authToken = this.config.get<string>('twilio.authToken');
    this.fromPhone = this.config.get<string>('twilio.fromPhone') ?? '';

    if (!accountSid || !authToken || !this.fromPhone) {
      this.logger.warn(
        'Twilio credentials not configured. SMS will be disabled.',
      );
      return;
    }

    this.client = new Twilio(accountSid, authToken);
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString('en-AU', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Australia/Sydney',
    });
  }

  private async send(to: string, message: string): Promise<void> {
    if (!this.client) {
      this.logger.warn('Twilio not configured. Skipping SMS.');
      throw new Error('SMS service not configured');
    }

    try {
      await this.client.messages.create({
        body: message,
        from: this.fromPhone,
        to,
      });
      this.logger.log(`SMS sent to ${to}`);
    } catch (err: any) {
      this.logger.error(`Failed to send SMS to ${to}: ${err.message}`);
      throw err;
    }
  }

  async sendAppointmentConfirmation(ctx: AppointmentSmsContext): Promise<void> {
    let message = `Hi ${ctx.brideName}, your ${ctx.title} appointment is confirmed for ${this.formatDateTime(ctx.startTime)}`;
    if (ctx.location) message += ` at ${ctx.location}`;
    if (ctx.description) message += `. ${ctx.description}`;
    if (ctx.whatToBring) message += `. Bring: ${ctx.whatToBring}`;
    message += `. - Fatima K Design`;
    await this.send(ctx.bridePhone, message);
  }

  async sendAppointmentUpdate(ctx: AppointmentSmsContext): Promise<void> {
    let message = `Hi ${ctx.brideName}, your ${ctx.title} appointment has been updated to ${this.formatDateTime(ctx.startTime)}`;
    if (ctx.location) message += ` at ${ctx.location}`;
    if (ctx.description) message += `. ${ctx.description}`;
    if (ctx.whatToBring) message += `. Bring: ${ctx.whatToBring}`;
    message += `. - Fatima K Design`;
    await this.send(ctx.bridePhone, message);
  }

  async sendAppointmentReminder(ctx: AppointmentSmsContext): Promise<void> {
    let message = `Reminder: Your ${ctx.title} appointment is in 48 hours (${this.formatDateTime(ctx.startTime)})`;
    if (ctx.description) message += `. ${ctx.description}`;
    if (ctx.whatToBring) message += `. Bring: ${ctx.whatToBring}`;
    message += `. See you soon! - Fatima K Design`;
    await this.send(ctx.bridePhone, message);
  }

  async sendAppointmentCancellation(ctx: AppointmentSmsContext): Promise<void> {
    const message = `Hi ${ctx.brideName}, your ${ctx.title} appointment has been cancelled. Please contact us to reschedule. - Fatima K Design`;
    await this.send(ctx.bridePhone, message);
  }

  async sendPaymentRequest(ctx: PaymentSmsContext): Promise<void> {
    const amount = Number(ctx.amount);
    let message = `Hi ${ctx.brideName}, you have a new payment due for ${ctx.label}: $${amount.toLocaleString()}`;

    if (ctx.dueDate) {
      const dueDate = ctx.dueDate.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Australia/Sydney',
      });
      message += `. Due date: ${dueDate}`;
    }

    message += `. Please check your portal for more details. - Fatima K Design`;
    await this.send(ctx.bridePhone, message);
  }

  async sendPaymentReminder(ctx: PaymentReminderSmsContext): Promise<void> {
    const message = `Hi ${ctx.brideName}, payment reminder: You have ${ctx.paymentCount} pending payment${ctx.paymentCount > 1 ? 's' : ''} totaling $${ctx.totalAmount.toLocaleString()}. Please check your portal to complete payment. - Fatima K Design`;
    await this.send(ctx.bridePhone, message);
  }

  async sendWelcomeSms(
    brideName: string,
    bridePhone: string,
    temporaryPassword: string,
  ): Promise<void> {
    const message = `Welcome ${brideName}! Your Fatima K Design portal is ready. Password: ${temporaryPassword}. Change it after login.`;
    await this.send(bridePhone, message);
  }
}
