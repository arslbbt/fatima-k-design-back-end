# Notification Status Response Guide

## Overview

All services that send notifications now return a `notificationStatus` object in their response, allowing the frontend to display appropriate messages to the admin.

## Response Structure

```typescript
{
  // ... regular response data (appointment, payment, user, etc.)
  notificationStatus: {
    emailSent: boolean,
    smsSent: boolean,
    message: string
  }
}
```

## Services Returning Notification Status

### 1. Appointments Service

#### Create Appointment

```typescript
POST /appointments

Response:
{
  id: "...",
  brideId: "...",
  title: "CONSULTATION",
  // ... other appointment fields
  notificationStatus: {
    emailSent: true,
    smsSent: true,
    message: "Email and SMS sent successfully"
  }
}
```

### 2. Payments Service

#### Create Payment

```typescript
POST /payments

Response:
{
  id: "...",
  brideId: "...",
  amount: 500,
  // ... other payment fields
  notificationStatus: {
    emailSent: true,
    smsSent: false,
    message: "Email sent (SMS not configured)"
  }
}
```

#### Update Payment

```typescript
PATCH /payments/:id

Response:
{
  id: "...",
  amount: 600,
  // ... other payment fields
  notificationStatus: {
    emailSent: true,
    smsSent: true,
    message: "Email and SMS sent successfully"
  }
}
```

#### Send Payment Reminder

```typescript
POST /payments/:brideId/reminder

Response:
{
  message: "Reminder sent successfully",
  notificationStatus: {
    emailSent: true,
    smsSent: true,
    message: "Email and SMS sent successfully"
  }
}
```

### 3. Auth Service

#### Register Bride

```typescript
POST /auth/register

Response:
{
  id: "...",
  name: "Jane Doe",
  email: "jane@example.com",
  // ... other user fields
  notificationStatus: {
    emailSent: true,
    smsSent: true,
    message: "Email and SMS sent successfully"
  }
}
```

### 4. Admin Service

#### Create Bride (Admin)

```typescript
POST /admin/brides

Response:
{
  id: "...",
  name: "Jane Doe",
  email: "jane@example.com",
  // ... other user fields
  notificationStatus: {
    emailSent: true,
    smsSent: false,
    message: "Email sent, but SMS failed: Invalid phone number format"
  }
}
```

## Possible Message Values

### Success Messages

- `"Email and SMS sent successfully"` - Both channels succeeded
- `"Email sent (SMS not configured)"` - Only email sent (no phone number or Twilio not configured)

### Partial Success Messages

- `"Email sent, but SMS failed: [error]"` - Email succeeded, SMS failed with reason
- `"SMS sent, but email failed: [error]"` - SMS succeeded, email failed with reason

### Failure Messages

- `"Both email and SMS failed. Email: [error], SMS: [error]"` - Both channels failed
- `"Payment marked as paid, no notification sent"` - Payment created as already paid
- `"Notification failed"` - Generic failure (rare)

## Frontend Implementation Examples

### React/TypeScript Example

```typescript
// After creating appointment
const response = await api.appointments.create(appointmentData);

if (
  response.notificationStatus.emailSent &&
  response.notificationStatus.smsSent
) {
  toast.success('Appointment created. Email and SMS sent to bride.');
} else if (response.notificationStatus.emailSent) {
  toast.warning(`Appointment created. ${response.notificationStatus.message}`);
} else if (response.notificationStatus.smsSent) {
  toast.warning(`Appointment created. ${response.notificationStatus.message}`);
} else {
  toast.error(
    `Appointment created, but notifications failed. Please contact bride manually.`,
  );
}
```

### Notification Badge Component

```typescript
interface NotificationBadgeProps {
  status: {
    emailSent: boolean;
    smsSent: boolean;
    message: string;
  };
}

function NotificationBadge({ status }: NotificationBadgeProps) {
  if (status.emailSent && status.smsSent) {
    return <Badge color="green">✓ Email & SMS Sent</Badge>;
  } else if (status.emailSent || status.smsSent) {
    return (
      <Badge color="yellow" tooltip={status.message}>
        ⚠ Partial Success
      </Badge>
    );
  } else {
    return (
      <Badge color="red" tooltip={status.message}>
        ✗ Notification Failed
      </Badge>
    );
  }
}
```

### Toast Notification Helper

```typescript
function showNotificationToast(status: NotificationStatus) {
  const { emailSent, smsSent, message } = status;

  if (emailSent && smsSent) {
    toast.success(message, { icon: '✓' });
  } else if (emailSent || smsSent) {
    toast.warning(message, { icon: '⚠' });
  } else {
    toast.error(message, { icon: '✗' });
  }
}

// Usage
const response = await api.payments.create(paymentData);
showNotificationToast(response.notificationStatus);
```

## Utility Function Location

The notification message builder is centralized in:

```
src/common/utils/notification.util.ts
```

This utility is used by all services to generate consistent messages.

## Testing Notification Status

### Test All Success

1. Configure both Mailjet and Twilio in `.env`
2. Create bride with valid phone number
3. Create appointment
4. Check response: `emailSent: true, smsSent: true`

### Test Email Only

1. Remove Twilio credentials from `.env`
2. Create appointment
3. Check response: `emailSent: true, smsSent: false`
4. Message: "Email sent (SMS not configured)"

### Test SMS Only

1. Remove Mailjet credentials from `.env`
2. Create appointment
3. Check response: `emailSent: false, smsSent: true`
4. Message: "SMS sent, but email failed: [error]"

### Test No Phone Number

1. Configure both services
2. Create bride without phone number
3. Create appointment
4. Check response: `emailSent: true, smsSent: false`
5. Message: "Email sent (SMS not configured)"

## Benefits

1. **Transparency**: Admin knows exactly what was sent
2. **Actionable**: Admin can retry or contact bride manually if needed
3. **Debugging**: Clear error messages help identify configuration issues
4. **User Experience**: Appropriate UI feedback based on actual results
5. **Audit Trail**: Response can be logged for tracking notification delivery
