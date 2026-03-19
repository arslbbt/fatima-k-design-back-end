export interface AppointmentEmailContext {
  brideName: string;
  brideEmail: string;
  title: string;
  location: string | null;
  startTime: Date;
  endTime: Date;
  whatToBring: string | null;
}

/**
 * IMailService — swap the implementation (Mailjet → SES → Resend)
 * without touching any caller. Just replace the provider in MailModule.
 */
export interface IMailService {
  sendAppointmentConfirmation(ctx: AppointmentEmailContext): Promise<void>;
  sendAppointmentReminder(ctx: AppointmentEmailContext): Promise<void>;
  sendAppointmentCancellation(ctx: AppointmentEmailContext): Promise<void>;
}

export const MAIL_SERVICE = 'MAIL_SERVICE';
