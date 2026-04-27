# SMS Integration with Twilio

## Overview

Integrated Twilio SMS alongside existing email notifications using a centralized notification service. Both email and SMS are sent automatically for appointments, payments, and bride registration.

## Architecture

### Centralized Notification Service

- `NotificationService` orchestrates both email and SMS
- Sends notifications in parallel using `Promise.allSettled`
- SMS only sent if bride has phone number in profile
- Failures in one channel don't affect the other

### SMS Service Layer

- `ISmsService` interface defines SMS contract
- `TwilioService` implements SMS using Twilio SDK
- Follows same pattern as existing `MailjetService`

## Configuration

Add to `.env`:

```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_PHONE=+1234567890
```

## Notification Types

### Appointments

- Confirmation (create)
- Update (reschedule/modify)
- Cancellation (cancel/delete)
- Reminder (48 hours before)

### Payments

- Payment request (new payment)
- Payment reminder (pending payments)

### Bride Registration

- Welcome message with temporary password

## SMS Message Templates

Messages are concise and branded:

- Appointment confirmation: "Hi {name}, your {title} appointment is confirmed for {date} at {location}. - Fatima K Design"
- Payment request: "Hi {name}, a payment of ${amount} for {label} due {date} has been added. Check your portal. - Fatima K Design"
- Welcome: "Welcome to Fatima K Design, {name}! Your portal is ready. Temporary password: {password}. Please change it after first login."

## Files Modified

### New Files

- `src/common/sms/sms.interface.ts` - SMS service contract
- `src/common/sms/twilio.service.ts` - Twilio implementation
- `src/common/sms/sms.module.ts` - SMS module
- `src/common/notifications/notification.service.ts` - Centralized orchestrator
- `src/common/notifications/notification.module.ts` - Notification module

### Updated Files

- `src/config/env.config.ts` - Added Twilio config
- `src/modules/appointments/appointments.service.ts` - Use NotificationService
- `src/modules/appointments/appointments.module.ts` - Import NotificationModule
- `src/modules/payments/payments.service.ts` - Use NotificationService
- `src/modules/payments/payments.module.ts` - Import NotificationModule
- `src/modules/auth/auth.service.ts` - Use NotificationService
- `src/modules/auth/auth.module.ts` - Import NotificationModule
- `src/modules/admin/admin.service.ts` - Use NotificationService
- `src/modules/admin/admin.module.ts` - Import NotificationModule

## Usage

Services automatically use NotificationService. No changes needed to controllers or existing logic. Phone numbers are fetched from `brideProfile.phone` when available.

## Testing

1. Add Twilio credentials to `.env`
2. Ensure bride has phone number in profile
3. Create appointment/payment or register bride
4. Both email and SMS will be sent

## Benefits

- Centralized notification logic
- Easy to add new channels (push, WhatsApp, etc.)
- Graceful degradation (SMS failure doesn't block email)
- Consistent message formatting
- Phone number optional (SMS skipped if not provided)
