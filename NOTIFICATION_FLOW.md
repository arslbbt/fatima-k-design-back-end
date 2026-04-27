# Notification Flow Documentation

## Architecture Overview

The notification system uses a **centralized approach** with the `NotificationService` as the single entry point for all email and SMS notifications.

```
Controller/Service
       ↓
NotificationService (Centralized)
       ↓
   ┌───┴───┐
   ↓       ↓
Email    SMS
(Mailjet) (Twilio)
```

## How It Works

### 1. Single Entry Point

All services (appointments, payments, auth, admin) call **only** `NotificationService`. They never call email or SMS services directly.

### 2. Parallel Execution

`NotificationService` sends both email and SMS **in parallel** using `Promise.allSettled()`:

- Both channels execute simultaneously (faster)
- One failure doesn't block the other
- Both channels are independent

### 3. Graceful Degradation

```typescript
// If email fails → SMS still sent
// If SMS fails → Email still sent
// If both fail → Both errors logged
// If phone missing → Only email sent
```

### 4. Status Reporting

`NotificationService` returns a `NotificationResult` object:

```typescript
{
  emailSent: boolean,      // true if email succeeded
  smsSent: boolean,        // true if SMS succeeded
  emailError?: string,     // error message if email failed
  smsError?: string        // error message if SMS failed
}
```

## Flow Example: Creating an Appointment

```
1. Admin creates appointment via API
   ↓
2. AppointmentsService.create()
   ↓
3. Save appointment to database
   ↓
4. Call NotificationService.sendAppointmentConfirmation()
   ↓
5. NotificationService executes in parallel:
   ├─→ MailjetService.sendAppointmentConfirmation()
   └─→ TwilioService.sendAppointmentConfirmation() (if phone exists)
   ↓
6. NotificationService returns result:
   {
     emailSent: true,
     smsSent: true,
     message: "Email and SMS sent successfully"
   }
   ↓
7. AppointmentsService returns to controller with notification status
   ↓
8. Controller returns response to frontend with notification status
```

## Failure Scenarios

### Scenario 1: Email Fails, SMS Succeeds

```json
{
  "emailSent": false,
  "smsSent": true,
  "emailError": "Mailjet API error: Invalid API key",
  "message": "SMS sent, but email failed: Mailjet API error"
}
```

**Result**: Bride receives SMS, admin sees warning in UI

### Scenario 2: SMS Fails, Email Succeeds

```json
{
  "emailSent": true,
  "smsSent": false,
  "smsError": "Invalid phone number format",
  "message": "Email sent, but SMS failed: Invalid phone number format"
}
```

**Result**: Bride receives email, admin sees warning in UI

### Scenario 3: Both Fail

```json
{
  "emailSent": false,
  "smsSent": false,
  "emailError": "Network timeout",
  "smsError": "Twilio account suspended",
  "message": "Both email and SMS failed"
}
```

**Result**: Admin sees error, can retry manually

### Scenario 4: No Phone Number

```json
{
  "emailSent": true,
  "smsSent": false,
  "message": "Email sent (SMS not configured)"
}
```

**Result**: Only email sent, no error shown

## Configuration

### Twilio Not Configured

If Twilio credentials are missing or invalid:

- SMS service logs warning: "Twilio not configured. SMS will be disabled."
- All SMS attempts return error
- Email continues to work normally
- No application crash

### Email Not Configured

If Mailjet credentials are missing:

- Email service throws error
- SMS continues to work normally
- Notification result shows email failure

## UI Integration

### Frontend Display Logic

```typescript
// In your frontend component
if (
  response.notificationStatus.emailSent &&
  response.notificationStatus.smsSent
) {
  showSuccess('Appointment created. Email and SMS sent.');
} else if (response.notificationStatus.emailSent) {
  showWarning('Appointment created. Email sent, but SMS failed.');
} else if (response.notificationStatus.smsSent) {
  showWarning('Appointment created. SMS sent, but email failed.');
} else {
  showError(
    'Appointment created, but notifications failed. Please contact bride manually.',
  );
}
```

## Notification Types & Triggers

### Appointments

| Action   | Email | SMS | Trigger                           |
| -------- | ----- | --- | --------------------------------- |
| Create   | ✓     | ✓   | Admin creates appointment         |
| Update   | ✓     | ✓   | Admin modifies appointment        |
| Cancel   | ✓     | ✓   | Admin cancels/deletes appointment |
| Reminder | ✓     | ✓   | Cron job (48 hours before)        |

### Payments

| Action   | Email | SMS | Trigger                      |
| -------- | ----- | --- | ---------------------------- |
| Create   | ✓     | ✓   | Admin adds payment           |
| Update   | ✓     | ✓   | Admin modifies payment       |
| Reminder | ✓     | ✓   | Admin clicks "Send Reminder" |

### Bride Registration

| Action   | Email | SMS | Trigger                          |
| -------- | ----- | --- | -------------------------------- |
| Register | ✓     | ✓   | Admin/Auth creates bride account |

## Logging

All notification attempts are logged:

```
✓ Email and SMS sent successfully
✓ Email sent (SMS skipped or failed)
✓ SMS sent (Email failed)
✗ Both email and SMS failed
```

Check logs at: `bridal-backend/logs/` or console output

## Testing

### Test Email Only

1. Remove Twilio credentials from `.env`
2. Create appointment
3. Result: Email sent, SMS skipped

### Test SMS Only

1. Remove Mailjet credentials from `.env`
2. Create appointment
3. Result: SMS sent, email failed

### Test Both

1. Add both credentials to `.env`
2. Ensure bride has phone number
3. Create appointment
4. Result: Both sent

## Key Benefits

1. **Centralized Control**: One service manages all notifications
2. **Fault Tolerance**: One channel failure doesn't affect the other
3. **Transparency**: UI knows exactly what was sent
4. **Easy Extension**: Add WhatsApp, Push, etc. by updating NotificationService
5. **Consistent Logging**: All notifications logged in one place
6. **Graceful Degradation**: Missing config doesn't crash app
