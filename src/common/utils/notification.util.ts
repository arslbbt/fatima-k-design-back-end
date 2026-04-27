export interface NotificationResult {
  emailSent: boolean;
  smsSent: boolean;
  emailError?: string;
  smsError?: string;
}

export function buildNotificationMessage(result: NotificationResult): string {
  if (result.emailSent && result.smsSent) {
    return 'Email and SMS sent successfully';
  } else if (result.emailSent && !result.smsSent) {
    return result.smsError
      ? `Email sent, but SMS failed: ${result.smsError}`
      : 'Email sent (SMS not configured)';
  } else if (!result.emailSent && result.smsSent) {
    return `SMS sent, but email failed: ${result.emailError}`;
  } else {
    return `Both email and SMS failed. Email: ${result.emailError}, SMS: ${result.smsError}`;
  }
}
