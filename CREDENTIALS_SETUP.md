# Credentials Setup Guide

Follow these steps to get Mailjet and Google Calendar working.

---

## 1. Mailjet

1. Go to https://app.mailjet.com and create a free account
2. From the dashboard go to **Account Settings → REST API → API Key Management**
3. Copy your **API Key** and **Secret Key**
4. Go to **Senders & Domains → Add a Sender Domain** and verify your domain (or use a single sender email)
5. Add to your `.env`:

```env
MAILJET_API_KEY=your_api_key_here
MAILJET_SECRET_KEY=your_secret_key_here
MAILJET_FROM_EMAIL=hello@fatimakdesign.com
MAILJET_FROM_NAME=Fatima K Design
```

---

## 2. Google Calendar (Service Account)

### Step 1 — Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. Create a new project (e.g. `fatimak-bridal`)

### Step 2 — Enable the Calendar API

1. In the project, go to **APIs & Services → Library**
2. Search for **Google Calendar API** and enable it

### Step 3 — Create a Service Account

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → Service Account**
3. Give it a name (e.g. `bridal-calendar-bot`) and click **Done**
4. Click on the service account → **Keys** tab → **Add Key → Create new key → JSON**
5. Download the JSON file

### Step 4 — Share your calendar with the service account

1. Open **Google Calendar** (calendar.google.com)
2. Find the calendar you want to use (or create a new one e.g. `Fatima K Appointments`)
3. Click the three dots next to it → **Settings and sharing**
4. Under **Share with specific people**, add the service account email (looks like `bridal-calendar-bot@your-project.iam.gserviceaccount.com` bridal-calendar-bot@fatima-k-designs.iam.gserviceaccount.com)
5. Give it **Make changes to events** permission
6. Copy the **Calendar ID** from the same settings page (under **Integrate calendar**)

### Step 5 — Add to `.env`

From the downloaded JSON file, copy these two values:

```env
GOOGLE_CLIENT_EMAIL=bridal-calendar-bot@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com
```

> Important: The private key must be on one line with `\n` for line breaks, wrapped in double quotes.

---

## Final `.env` checklist

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your_jwt_secret

MAILJET_API_KEY=
MAILJET_SECRET_KEY=
MAILJET_FROM_EMAIL=
MAILJET_FROM_NAME=Fatima K Design

GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CALENDAR_ID=
```

Once all values are filled in, restart the server and test by creating an appointment.
