export interface AppointmentSmsContext {
  brideName: string;
  bridePhone: string;
  title: string;
  description: string | null;
  startTime: Date;
  location: string | null;
  whatToBring: string | null;
}

export interface PaymentSmsContext {
  brideName: string;
  bridePhone: string;
  amount: number;
  currency: string;
  label: string;
  dueDate: Date | null;
}

export interface PaymentReminderSmsContext {
  brideName: string;
  bridePhone: string;
  totalAmount: number;
  currency: string;
  paymentCount: number;
}

export interface ISmsService {
  sendAppointmentConfirmation(ctx: AppointmentSmsContext): Promise<void>;
  sendAppointmentReminder(ctx: AppointmentSmsContext): Promise<void>;
  sendAppointmentCancellation(ctx: AppointmentSmsContext): Promise<void>;
  sendAppointmentUpdate(ctx: AppointmentSmsContext): Promise<void>;
  sendPaymentRequest(ctx: PaymentSmsContext): Promise<void>;
  sendPaymentReminder(ctx: PaymentReminderSmsContext): Promise<void>;
  sendWelcomeSms(
    brideName: string,
    bridePhone: string,
    temporaryPassword: string,
  ): Promise<void>;
}

export const SMS_SERVICE = 'SMS_SERVICE';
