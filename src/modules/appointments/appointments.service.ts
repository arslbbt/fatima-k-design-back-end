import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GoogleCalendarService } from '../../common/google-calendar/google-calendar.service';
import { MAIL_SERVICE } from '../../common/mail/mail.interface';
import type { IMailService } from '../../common/mail/mail.interface';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { randomUUID } from 'crypto';

const APPOINTMENT_SELECT = {
  id: true,
  brideId: true,
  title: true,
  description: true,
  location: true,
  startTime: true,
  endTime: true,
  whatToBring: true,
  status: true,
  createdBy: true,
  googleEventId: true,
  icsUid: true,
  icsSequence: true,
  reminderSentAt: true,
  createdAt: true,
} as const;

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private googleCalendar: GoogleCalendarService,
    @Inject(MAIL_SERVICE) private mailService: IMailService,
  ) {}

  async create(dto: CreateAppointmentDto, adminId: string) {
    const bride = await this.prisma.user.findFirst({
      where: { id: dto.brideId, role: 'BRIDE' },
      select: { id: true, name: true, email: true },
    });
    if (!bride) throw new NotFoundException('Bride not found');

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const icsUid = randomUUID();

    const appointment = await this.prisma.appointment.create({
      data: {
        brideId: dto.brideId,
        title: dto.title,
        description: dto.description ?? null,
        location: dto.location ?? null,
        startTime,
        endTime,
        whatToBring: dto.whatToBring ?? null,
        createdBy: adminId,
        icsUid,
        icsSequence: 0,
      },
      select: APPOINTMENT_SELECT,
    });

    // Google Calendar (non-fatal)
    const googleEventId = await this.googleCalendar.createEvent({
      summary: `${dto.title.replace('_', ' ')} — ${bride.name}`,
      description: dto.description,
      location: dto.location,
      startTime,
      endTime,
    });

    if (googleEventId) {
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { googleEventId },
      });
    }

    // In-app notification
    await this.prisma.notification.create({
      data: {
        brideId: dto.brideId,
        type: 'APPOINTMENT',
        message: `Your ${dto.title.replace('_', ' ')} appointment has been scheduled for ${startTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
      },
    });

    // Confirmation email with ICS
    await this.mailService.sendAppointmentConfirmation({
      brideName: bride.name,
      brideEmail: bride.email,
      title: dto.title.replace('_', ' '),
      location: dto.location ?? null,
      startTime,
      endTime,
      whatToBring: dto.whatToBring ?? null,
      ics: { uid: icsUid, sequence: 0, method: 'REQUEST' },
    });

    return {
      ...appointment,
      googleEventId: googleEventId ?? appointment.googleEventId,
    };
  }

  async findAllForAdmin() {
    return this.prisma.appointment.findMany({
      select: APPOINTMENT_SELECT,
      orderBy: { startTime: 'asc' },
    });
  }

  async findAllForBride(brideId: string) {
    return this.prisma.appointment.findMany({
      where: { brideId },
      select: APPOINTMENT_SELECT,
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: string, requesterId: string, requesterRole: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      select: APPOINTMENT_SELECT,
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    if (requesterRole === 'BRIDE' && appointment.brideId !== requesterId) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { bride: { select: { name: true, email: true } } },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    const isCancellation = dto.status === 'CANCELLED';
    const newSequence = (appointment.icsSequence ?? 0) + 1;

    const data: Record<string, unknown> = { icsSequence: newSequence };
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.whatToBring !== undefined) data.whatToBring = dto.whatToBring;
    if (dto.status !== undefined) data.status = dto.status;

    let startTime = appointment.startTime;
    let endTime = appointment.endTime;

    if (dto.startTime !== undefined) {
      startTime = new Date(dto.startTime);
      data.startTime = startTime;
    }
    if (dto.endTime !== undefined) {
      endTime = new Date(dto.endTime);
      data.endTime = endTime;
    }

    if (endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data,
      select: APPOINTMENT_SELECT,
    });

    // Sync Google Calendar
    if (appointment.googleEventId) {
      await this.googleCalendar.updateEvent(appointment.googleEventId, {
        summary: dto.title
          ? `${dto.title.replace('_', ' ')} — ${appointment.bride.name}`
          : undefined,
        description: dto.description,
        location: dto.location,
        startTime: dto.startTime ? startTime : undefined,
        endTime: dto.endTime ? endTime : undefined,
      });
    }

    const icsUid = appointment.icsUid ?? randomUUID();
    const emailCtx = {
      brideName: appointment.bride.name,
      brideEmail: appointment.bride.email,
      title: (dto.title ?? appointment.title).replace('_', ' '),
      location:
        dto.location !== undefined ? dto.location : appointment.location,
      startTime,
      endTime,
      whatToBring:
        dto.whatToBring !== undefined
          ? dto.whatToBring
          : appointment.whatToBring,
      ics: {
        uid: icsUid,
        sequence: newSequence,
        method: isCancellation ? ('CANCEL' as const) : ('REQUEST' as const),
      },
    };

    if (isCancellation) {
      await this.prisma.notification.create({
        data: {
          brideId: appointment.brideId,
          type: 'APPOINTMENT',
          message: `Your ${appointment.title.replace('_', ' ')} appointment has been cancelled.`,
        },
      });
      await this.mailService.sendAppointmentCancellation(emailCtx);
    } else {
      await this.prisma.notification.create({
        data: {
          brideId: appointment.brideId,
          type: 'APPOINTMENT',
          message: `Your ${(dto.title ?? appointment.title).replace('_', ' ')} appointment has been updated.`,
        },
      });
      await this.mailService.sendAppointmentUpdate(emailCtx);
    }

    return updated;
  }

  async remove(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    if (appointment.googleEventId) {
      await this.googleCalendar.deleteEvent(appointment.googleEventId);
    }

    await this.prisma.appointment.delete({ where: { id } });
    return { message: 'Appointment deleted successfully' };
  }

  // ── Cron job ──────────────────────────────────────────────────

  async sendPendingReminders() {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const in47h = new Date(now.getTime() + 47 * 60 * 60 * 1000);

    const upcoming = await this.prisma.appointment.findMany({
      where: {
        status: 'SCHEDULED',
        reminderSentAt: null,
        startTime: { gte: in47h, lte: in48h },
      },
      include: { bride: { select: { name: true, email: true } } },
    });

    for (const appt of upcoming) {
      // Reminder email — no ICS, event already in their calendar
      await this.mailService.sendAppointmentReminder({
        brideName: appt.bride.name,
        brideEmail: appt.bride.email,
        title: appt.title.replace('_', ' '),
        location: appt.location,
        startTime: appt.startTime,
        endTime: appt.endTime,
        whatToBring: appt.whatToBring,
      });

      await this.prisma.notification.create({
        data: {
          brideId: appt.brideId,
          type: 'APPOINTMENT',
          message: `Reminder: Your ${appt.title.replace('_', ' ')} appointment is in 48 hours.`,
        },
      });

      await this.prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: new Date() },
      });
    }
  }
}
