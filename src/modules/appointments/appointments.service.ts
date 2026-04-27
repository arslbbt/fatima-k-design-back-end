import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GoogleCalendarService } from '../../common/google-calendar/google-calendar.service';
import { NotificationService } from '../../common/notifications/notification.service';
import { buildNotificationMessage } from '../../common/utils/notification.util';
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

// Full appointment shape including bride relation — used in update/remove
const APPOINTMENT_WITH_BRIDE = {
  ...APPOINTMENT_SELECT,
  bride: {
    select: {
      name: true,
      email: true,
      brideProfile: { select: { phone: true } },
    },
  },
} as const;

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private prisma: PrismaService,
    private googleCalendar: GoogleCalendarService,
    private notificationService: NotificationService,
  ) {}

  async create(dto: CreateAppointmentDto, adminId: string) {
    const bride = await this.prisma.user.findFirst({
      where: { id: dto.brideId, role: 'BRIDE' },
      select: {
        id: true,
        name: true,
        email: true,
        brideProfile: { select: { phone: true } },
      },
    });
    if (!bride) throw new NotFoundException('Bride not found');

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const icsUid = randomUUID();
    // Resolve display title — use customTitle when title is CUSTOM
    const displayTitle =
      (dto.title as string) === 'CUSTOM' && dto.customTitle
        ? dto.customTitle
        : dto.title.replace(/_/g, ' ');

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
      summary: `${displayTitle} — ${bride.name}`,
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
        message: `Your ${displayTitle} appointment has been scheduled for ${startTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
      },
    });

    // Send email + SMS notification
    let notificationStatus = {
      emailSent: false,
      smsSent: false,
      message: 'Notification failed',
    };

    try {
      const result = await this.notificationService.sendAppointmentConfirmation(
        {
          brideName: bride.name,
          brideEmail: bride.email,
          bridePhone: bride.brideProfile?.phone,
          title: displayTitle,
          description: dto.description ?? null,
          location: dto.location ?? null,
          startTime,
          endTime,
          whatToBring: dto.whatToBring ?? null,
          ics: { uid: icsUid, sequence: 0, method: 'REQUEST' },
        },
      );

      notificationStatus = {
        emailSent: result.emailSent,
        smsSent: result.smsSent,
        message: buildNotificationMessage(result),
      };
    } catch (err) {
      this.logger.error('Failed to send confirmation notification', err);
    }

    return {
      ...appointment,
      googleEventId: googleEventId ?? appointment.googleEventId,
      notificationStatus,
    };
  }

  async findAllForAdmin(from?: Date, to?: Date) {
    return this.prisma.appointment.findMany({
      where: {
        ...(from || to
          ? {
              startTime: { ...(from && { gte: from }), ...(to && { lte: to }) },
            }
          : {}),
      },
      select: {
        ...APPOINTMENT_SELECT,
        bride: { select: { id: true, name: true, email: true } },
      },
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
      select: APPOINTMENT_WITH_BRIDE,
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    const isCancellation =
      dto.status === 'CANCELLED' && appointment.status !== 'CANCELLED';

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
      if (isCancellation) {
        await this.googleCalendar.deleteEvent(appointment.googleEventId);
      } else {
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
    }

    const icsUid = appointment.icsUid ?? randomUUID();
    const emailCtx = {
      brideName: appointment.bride.name,
      brideEmail: appointment.bride.email,
      title: (dto.title ?? appointment.title).replace('_', ' '),
      description:
        dto.description !== undefined
          ? dto.description
          : appointment.description,
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
      try {
        await this.notificationService.sendAppointmentCancellation({
          ...emailCtx,
          bridePhone: appointment.bride.brideProfile?.phone,
        });
        this.logger.log(
          `Cancellation notification sent to ${appointment.bride.email}`,
        );
      } catch (err) {
        this.logger.error('Failed to send cancellation notification', err);
      }
    } else {
      await this.prisma.notification.create({
        data: {
          brideId: appointment.brideId,
          type: 'APPOINTMENT',
          message: `Your ${(dto.title ?? appointment.title).replace('_', ' ')} appointment has been updated.`,
        },
      });
      try {
        await this.notificationService.sendAppointmentUpdate({
          ...emailCtx,
          bridePhone: appointment.bride.brideProfile?.phone,
        });
        this.logger.log(
          `Update notification sent to ${appointment.bride.email}`,
        );
      } catch (err) {
        this.logger.error('Failed to send update notification', err);
      }
    }

    return updated;
  }

  async remove(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      select: APPOINTMENT_WITH_BRIDE,
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    if (appointment.googleEventId) {
      await this.googleCalendar.deleteEvent(appointment.googleEventId);
    }

    // Send cancellation email only if not already cancelled
    if (appointment.status !== 'CANCELLED') {
      const icsUid = appointment.icsUid ?? randomUUID();
      const newSequence = (appointment.icsSequence ?? 0) + 1;

      try {
        await this.notificationService.sendAppointmentCancellation({
          brideName: appointment.bride.name,
          brideEmail: appointment.bride.email,
          bridePhone: appointment.bride.brideProfile?.phone,
          title: appointment.title.replace('_', ' '),
          description: appointment.description,
          location: appointment.location,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          whatToBring: appointment.whatToBring,
          ics: { uid: icsUid, sequence: newSequence, method: 'CANCEL' },
        });
        this.logger.log(
          `Cancellation notification sent to ${appointment.bride.email}`,
        );
      } catch (err) {
        this.logger.error(
          'Failed to send cancellation notification on delete',
          err,
        );
      }

      await this.prisma.notification.create({
        data: {
          brideId: appointment.brideId,
          type: 'APPOINTMENT',
          message: `Your ${appointment.title.replace('_', ' ')} appointment has been cancelled.`,
        },
      });
    }

    await this.prisma.appointment.delete({ where: { id } });
    return { message: 'Appointment deleted successfully' };
  }

  // ── Cron job ──────────────────────────────────────────────────
  // Runs every hour. Finds appointments starting in 47–48hrs
  // where reminder hasn't been sent yet, sends email + notification.

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
      select: {
        id: true,
        brideId: true,
        title: true,
        description: true,
        location: true,
        startTime: true,
        endTime: true,
        whatToBring: true,
        bride: {
          select: {
            name: true,
            email: true,
            brideProfile: { select: { phone: true } },
          },
        },
      },
    });

    for (const appt of upcoming) {
      try {
        await this.notificationService.sendAppointmentReminder({
          brideName: appt.bride.name,
          brideEmail: appt.bride.email,
          bridePhone: appt.bride.brideProfile?.phone,
          title: appt.title.replace('_', ' '),
          description: appt.description,
          location: appt.location,
          startTime: appt.startTime,
          endTime: appt.endTime,
          whatToBring: appt.whatToBring,
          // No ICS — event already in their calendar
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
          data: { reminderSentAt: now },
        });

        this.logger.log(
          `Reminder sent to ${appt.bride.email} for appointment ${appt.id}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to send reminder for appointment ${appt.id}`,
          err,
        );
      }
    }
  }
}
