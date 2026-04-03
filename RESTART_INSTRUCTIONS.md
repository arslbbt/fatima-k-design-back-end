# Backend Restart Instructions

## Issue Fixed

The welcome email wasn't being sent because the admin service (used when creating brides from the admin panel) wasn't calling the email service.

## Changes Made

1. Updated `admin.service.ts` to inject and use the mail service
2. Updated `admin.module.ts` to import the MailModule
3. Added welcome email sending in the `registerBride` method

## How to Restart the Backend

### Option 1: Stop and Restart (Recommended)

1. Stop the current backend process (Ctrl+C in the terminal running `npm run start:dev`)
2. Restart it: `npm run start:dev`

### Option 2: Kill and Restart

```bash
# Find the process
ps aux | grep "nest start" | grep -v grep

# Kill it (replace PID with the actual process ID)
kill -9 <PID>

# Start again
cd bridal-backend
npm run start:dev
```

## Testing

After restarting, create a new bride from the admin panel. The bride should receive a welcome email with:

- Their email address
- Temporary password
- Link to the portal
- Instructions to change password

## Email Templates Now Available

1. **Welcome Email** - Sent when bride is registered
2. **Payment Request** - Sent when payment is created or edited
3. **Payment Reminder** - Sent when admin clicks "Send Reminder"
4. **Appointment Confirmation** - Sent when appointment is created
5. **Appointment Update** - Sent when appointment is modified
6. **Appointment Reminder** - Sent 48 hours before appointment
7. **Appointment Cancellation** - Sent when appointment is cancelled

All templates use the website's UI theme with consistent branding.
