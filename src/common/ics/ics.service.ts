import { Injectable } from '@nestjs/common';

export type IcsMethod = 'REQUEST' | 'CANCEL';

export interface IcsEventOptions {
  uid: string;
  sequence: number;
  method: IcsMethod;
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  organizerEmail: string;
  organizerName: string;
  attendeeEmail: string;
  attendeeName: string;
}

@Injectable()
export class IcsService {
  /**
   * Formats a Date to ICS UTC format: 20260410T100000Z
   */
  private toIcsDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  private escape(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  generate(opts: IcsEventOptions): string {
    const now = this.toIcsDate(new Date());
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Fatima K Design//Bridal Portal//EN',
      `METHOD:${opts.method}`,
      'BEGIN:VEVENT',
      `UID:${opts.uid}`,
      `SEQUENCE:${opts.sequence}`,
      `DTSTAMP:${now}`,
      `DTSTART:${this.toIcsDate(opts.startTime)}`,
      `DTEND:${this.toIcsDate(opts.endTime)}`,
      `SUMMARY:${this.escape(opts.summary)}`,
      opts.description ? `DESCRIPTION:${this.escape(opts.description)}` : null,
      opts.location ? `LOCATION:${this.escape(opts.location)}` : null,
      `ORGANIZER;CN=${this.escape(opts.organizerName)}:mailto:${opts.organizerEmail}`,
      `ATTENDEE;CN=${this.escape(opts.attendeeName)};RSVP=FALSE:mailto:${opts.attendeeEmail}`,
      opts.method === 'CANCEL' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');

    return lines;
  }
}
