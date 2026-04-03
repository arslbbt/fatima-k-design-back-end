export interface AppointmentEmailContext {
  brideName: string;
  brideEmail: string;
  title: string;
  location: string | null;
  startTime: Date;
  endTime: Date;
  whatToBring: string | null;
  // ICS attachment — present on create/update/cancel, absent on reminder
  ics?: {
    uid: string;
    sequence: number;
    method: 'REQUEST' | 'CANCEL';
  };
}

export interface PaymentEmailContext {
  brideName: string;
  brideEmail: string;
  amount: number;
  label: string;
  dueDate: Date | null;
  paymentUrl: string;
}

export interface PaymentReminderContext {
  brideName: string;
  brideEmail: string;
  payments: Array<{
    amount: number;
    label: string;
    dueDate: Date;
  }>;
  paymentUrl: string;
}

export interface IMailService {
  sendAppointmentConfirmation(ctx: AppointmentEmailContext): Promise<void>;
  sendAppointmentReminder(ctx: AppointmentEmailContext): Promise<void>;
  sendAppointmentCancellation(ctx: AppointmentEmailContext): Promise<void>;
  sendAppointmentUpdate(ctx: AppointmentEmailContext): Promise<void>;
  sendPaymentRequest(ctx: PaymentEmailContext): Promise<void>;
  sendPaymentReminder(ctx: PaymentReminderContext): Promise<void>;
  sendWelcomeEmail(
    brideName: string,
    brideEmail: string,
    temporaryPassword: string,
  ): Promise<void>;
}

export const MAIL_SERVICE = 'MAIL_SERVICE';
