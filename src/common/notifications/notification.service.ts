import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IMailService } from '../mail/mail.interface';
import { MAIL_SERVICE } from '../mail/mail.interface';
import type { ISmsService } from '../sms/sms.interface';
import { SMS_SERVICE } from '../sms/sms.interface';
import type { NotificationResult } from '../utils/notification.util';

export interface AppointmentNotificationContext {
  brideName: string;
  brideEmail: string;
  bridePhone?: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  whatToBring: string | null;
  ics?: {
    uid: string;
    sequence: number;
    method: 'REQUEST' | 'CANCEL';
  };
}

export interface PaymentNotificationContext {
  brideName: string;
  brideEmail: string;
  bridePhone?: string | null;
  amount: number;
  currency: string;
  label: string;
  dueDate: Date | null;
  paymentUrl: string;
}

export interface PaymentReminderNotificationContext {
  brideName: string;
  brideEmail: string;
  bridePhone?: string | null;
  currency: string;
  payments: Array<{
    amount: number;
    label: string;
    dueDate: Date;
  }>;
  paymentUrl: string;
}

export interface WelcomeNotificationContext {
  brideName: string;
  brideEmail: string;
  bridePhone?: string | null;
  temporaryPassword: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(MAIL_SERVICE) private mailService: IMailService,
    @Inject(SMS_SERVICE) private smsService: ISmsService,
  ) {}

  async sendAppointmentConfirmation(
    ctx: AppointmentNotificationContext,
  ): Promise<NotificationResult> {
    const results = await Promise.allSettled([
      this.mailService.sendAppointmentConfirmation(ctx),
      ctx.bridePhone
        ? this.smsService.sendAppointmentConfirmation({
            brideName: ctx.brideName,
            bridePhone: ctx.bridePhone,
            title: ctx.title,
            description: ctx.description,
            startTime: ctx.startTime,
            location: ctx.location,
            whatToBring: ctx.whatToBring,
          })
        : Promise.resolve(),
    ]);

    return this.buildResult(results, !!ctx.bridePhone);
  }

  async sendAppointmentUpdate(
    ctx: AppointmentNotificationContext,
  ): Promise<NotificationResult> {
    const results = await Promise.allSettled([
      this.mailService.sendAppointmentUpdate(ctx),
      ctx.bridePhone
        ? this.smsService.sendAppointmentUpdate({
            brideName: ctx.brideName,
            bridePhone: ctx.bridePhone,
            title: ctx.title,
            description: ctx.description,
            startTime: ctx.startTime,
            location: ctx.location,
            whatToBring: ctx.whatToBring,
          })
        : Promise.resolve(),
    ]);

    return this.buildResult(results, !!ctx.bridePhone);
  }

  async sendAppointmentReminder(
    ctx: AppointmentNotificationContext,
  ): Promise<NotificationResult> {
    const results = await Promise.allSettled([
      this.mailService.sendAppointmentReminder(ctx),
      ctx.bridePhone
        ? this.smsService.sendAppointmentReminder({
            brideName: ctx.brideName,
            bridePhone: ctx.bridePhone,
            title: ctx.title,
            description: ctx.description,
            startTime: ctx.startTime,
            location: ctx.location,
            whatToBring: ctx.whatToBring,
          })
        : Promise.resolve(),
    ]);

    return this.buildResult(results, !!ctx.bridePhone);
  }

  async sendAppointmentCancellation(
    ctx: AppointmentNotificationContext,
  ): Promise<NotificationResult> {
    const results = await Promise.allSettled([
      this.mailService.sendAppointmentCancellation(ctx),
      ctx.bridePhone
        ? this.smsService.sendAppointmentCancellation({
            brideName: ctx.brideName,
            bridePhone: ctx.bridePhone,
            title: ctx.title,
            description: ctx.description,
            startTime: ctx.startTime,
            location: ctx.location,
            whatToBring: ctx.whatToBring,
          })
        : Promise.resolve(),
    ]);

    return this.buildResult(results, !!ctx.bridePhone);
  }

  async sendPaymentRequest(
    ctx: PaymentNotificationContext,
  ): Promise<NotificationResult> {
    const results = await Promise.allSettled([
      this.mailService.sendPaymentRequest(ctx),
      ctx.bridePhone
        ? this.smsService.sendPaymentRequest({
            brideName: ctx.brideName,
            bridePhone: ctx.bridePhone,
            amount: ctx.amount,
            currency: ctx.currency,
            label: ctx.label,
            dueDate: ctx.dueDate,
          })
        : Promise.resolve(),
    ]);

    return this.buildResult(results, !!ctx.bridePhone);
  }

  async sendPaymentReminder(
    ctx: PaymentReminderNotificationContext,
  ): Promise<NotificationResult> {
    const totalAmount = ctx.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    const results = await Promise.allSettled([
      this.mailService.sendPaymentReminder(ctx),
      ctx.bridePhone
        ? this.smsService.sendPaymentReminder({
            brideName: ctx.brideName,
            bridePhone: ctx.bridePhone,
            totalAmount,
            currency: ctx.currency,
            paymentCount: ctx.payments.length,
          })
        : Promise.resolve(),
    ]);

    return this.buildResult(results, !!ctx.bridePhone);
  }

  async sendWelcome(
    ctx: WelcomeNotificationContext,
  ): Promise<NotificationResult> {
    const results = await Promise.allSettled([
      this.mailService.sendWelcomeEmail(
        ctx.brideName,
        ctx.brideEmail,
        ctx.temporaryPassword,
      ),
      ctx.bridePhone
        ? this.smsService.sendWelcomeSms(
            ctx.brideName,
            ctx.bridePhone,
            ctx.temporaryPassword,
          )
        : Promise.resolve(),
    ]);

    return this.buildResult(results, !!ctx.bridePhone);
  }

  private buildResult(
    results: PromiseSettledResult<void>[],
    smsAttempted: boolean,
  ): NotificationResult {
    const emailResult = results[0];
    const smsResult = results[1];

    const result: NotificationResult = {
      emailSent: emailResult.status === 'fulfilled',
      smsSent: smsAttempted && smsResult.status === 'fulfilled',
    };

    if (emailResult.status === 'rejected') {
      result.emailError = emailResult.reason?.message || 'Email failed';
      this.logger.error(`Email failed: ${result.emailError}`);
    }

    if (smsAttempted && smsResult.status === 'rejected') {
      result.smsError = smsResult.reason?.message || 'SMS failed';
      this.logger.error(`SMS failed: ${result.smsError}`);
    }

    // Log success summary
    if (result.emailSent && result.smsSent) {
      this.logger.log('✓ Email and SMS sent successfully');
    } else if (result.emailSent) {
      this.logger.log('✓ Email sent (SMS skipped or failed)');
    } else if (result.smsSent) {
      this.logger.log('✓ SMS sent (Email failed)');
    } else {
      this.logger.error('✗ Both email and SMS failed');
    }

    return result;
  }
}
