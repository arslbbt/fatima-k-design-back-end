# Twilio SMS Setup Guide

## Step 1: Get Twilio Credentials

1. Go to [Twilio Console](https://console.twilio.com/)
2. Sign up or log in
3. From the dashboard, copy:
   - **Account SID** (starts with "AC...")
   - **Auth Token** (click to reveal)

## Step 2: Get a Phone Number

1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Select your country
3. Choose a number with SMS capability
4. Purchase the number
5. Copy the phone number (format: +1234567890)

## Step 3: Configure Environment

Update `bridal-backend/.env`:

```env
# Replace with your actual Twilio credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_PHONE=+1234567890
```

## Step 4: Test the Integration

1. Start the backend:

```bash
cd bridal-backend
npm run start:dev
```

2. Check logs for:

```
✓ Twilio initialized successfully
```

If you see:

```
⚠ Twilio credentials not configured. SMS will be disabled.
```

Then check your `.env` file.

## Step 5: Verify SMS Sending

1. Create a bride with a phone number
2. Create an appointment for that bride
3. Check logs for:

```
✓ Email and SMS sent successfully
SMS sent to +1234567890
```

## Troubleshooting

### Error: "accountSid must start with AC"

- Your Account SID is incorrect
- Make sure you copied the full SID from Twilio Console
- It should start with "AC" followed by 32 characters

### Error: "Invalid phone number"

- Phone numbers must be in E.164 format: +[country code][number]
- Example: +14155552671 (US), +447911123456 (UK)
- No spaces, dashes, or parentheses

### Error: "Twilio account suspended"

- Your trial account may have restrictions
- Verify your phone number in Twilio Console
- Upgrade to a paid account for production use

### SMS not sent but no error

- Check if bride has a phone number in their profile
- SMS is only sent if `brideProfile.phone` exists
- Check logs for: "SMS skipped (no phone number)"

## Trial Account Limitations

Twilio trial accounts have restrictions:

- Can only send SMS to verified phone numbers
- Messages include "Sent from your Twilio trial account"
- Limited number of messages

To remove restrictions:

1. Go to Twilio Console
2. Click **Upgrade** in the top banner
3. Add payment method
4. Upgrade to paid account

## Cost Estimate

Typical SMS costs (varies by country):

- US/Canada: ~$0.0075 per SMS
- UK: ~$0.04 per SMS
- Australia: ~$0.08 per SMS

For 100 brides with 5 notifications each:

- 500 SMS × $0.0075 = ~$3.75/month (US)

## Production Checklist

- [ ] Upgrade from trial account
- [ ] Set up billing alerts in Twilio Console
- [ ] Test with real phone numbers
- [ ] Monitor SMS delivery rates
- [ ] Set up error notifications
- [ ] Review message templates for compliance
- [ ] Check local SMS regulations (opt-out requirements)

## Support

- Twilio Docs: https://www.twilio.com/docs/sms
- Twilio Support: https://support.twilio.com/
- Check logs: `bridal-backend/logs/`
