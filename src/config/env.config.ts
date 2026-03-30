export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,

  storage: {
    path: process.env.STORAGE_PATH || '/var/www/storage',
    publicUrl: process.env.PUBLIC_URL,
  },

  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3001',
  },

  mailjet: {
    apiKey: process.env.MAILJET_API_KEY,
    secretKey: process.env.MAILJET_SECRET_KEY,
    fromEmail: process.env.MAILJET_FROM_EMAIL,
    fromName: process.env.MAILJET_FROM_NAME || 'Fatima K Design',
  },

  google: {
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    calendarId: process.env.GOOGLE_CALENDAR_ID,
  },
});
