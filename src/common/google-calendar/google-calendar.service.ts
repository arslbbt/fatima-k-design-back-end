import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';

export interface CalendarEventPayload {
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  attendeeEmail: string;
  attendeeName: string;
}

@Injectable()
export class GoogleCalendarService {
  private readonly calendar: calendar_v3.Calendar;
  private readonly calendarId: string;
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private config: ConfigService) {
    const auth = new google.auth.JWT({
      email: this.config.get<string>('google.clientEmail'),
      key: this.config.get<string>('google.privateKey'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    this.calendar = google.calendar({ version: 'v3', auth });
    this.calendarId = this.config.get<string>('google.calendarId') ?? '';
  }

  async createEvent(payload: CalendarEventPayload): Promise<string | null> {
    try {
      const res = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: {
          summary: payload.summary,
          description: payload.description,
          location: payload.location,
          start: { dateTime: payload.startTime.toISOString() },
          end: { dateTime: payload.endTime.toISOString() },
          attendees: [
            { email: payload.attendeeEmail, displayName: payload.attendeeName },
          ],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 48 * 60 },
              { method: 'popup', minutes: 60 },
            ],
          },
        },
      });
      return res.data.id ?? null;
    } catch (err) {
      this.logger.error('Failed to create Google Calendar event', err);
      return null; // non-fatal — appointment still saves
    }
  }

  async updateEvent(
    googleEventId: string,
    payload: Partial<CalendarEventPayload>,
  ): Promise<void> {
    try {
      await this.calendar.events.patch({
        calendarId: this.calendarId,
        eventId: googleEventId,
        requestBody: {
          ...(payload.summary && { summary: payload.summary }),
          ...(payload.description && { description: payload.description }),
          ...(payload.location && { location: payload.location }),
          ...(payload.startTime && {
            start: { dateTime: payload.startTime.toISOString() },
          }),
          ...(payload.endTime && {
            end: { dateTime: payload.endTime.toISOString() },
          }),
        },
      });
    } catch (err) {
      this.logger.error('Failed to update Google Calendar event', err);
    }
  }

  async deleteEvent(googleEventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: googleEventId,
      });
    } catch (err) {
      this.logger.error('Failed to delete Google Calendar event', err);
    }
  }
}
