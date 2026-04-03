import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ResetAdminPasswordDto } from './dto/reset-admin-password.dto';
import { RegisterBrideDto } from '../auth/dto/register-bride.dto';
import * as bcrypt from 'bcrypt';
import type { IMailService } from '../../common/mail/mail.interface';
import { MAIL_SERVICE } from '../../common/mail/mail.interface';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(MAIL_SERVICE) private mailService: IMailService,
  ) {}

  async listAllUsers(params: {
    page: number;
    limit: number;
    search?: string;
    role?: 'ADMIN' | 'BRIDE';
  }) {
    const { page, limit, search, role } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          brideProfile: { select: { stage: true, weddingDate: true } },
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAdminById(id: string) {
    const admin = await this.prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async registerBride(dto: RegisterBrideDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: 'BRIDE',
        brideProfile: {
          create: {
            weddingDate: dto.weddingDate ? new Date(dto.weddingDate) : null,
            phone: dto.phone ?? null,
            partnerName: dto.partnerName ?? null,
            venueName: dto.venueName ?? null,
            notes: dto.notes ?? null,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        brideProfile: true,
      },
    });

    // Send welcome email with login credentials
    try {
      await this.mailService.sendWelcomeEmail(
        user.name,
        user.email,
        dto.password,
      );
    } catch (err) {
      this.logger.error('Failed to send welcome email', err);
      // Don't throw - user is created successfully
    }

    return user;
  }

  async createAdmin(dto: CreateAdminDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async findAllAdmins() {
    return this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateAdmin(id: string, dto: UpdateAdminDto) {
    const admin = await this.prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
    });
    if (!admin) throw new NotFoundException('Admin not found');

    const data: Record<string, unknown> = {};
    if (dto.name) data.name = dto.name;
    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Email already in use');
      data.email = dto.email;
    }
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields provided to update');
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });
  }

  async removeAdmin(id: string, requestingAdminId: string) {
    if (id === requestingAdminId) {
      throw new BadRequestException('You cannot delete your own admin account');
    }

    const admin = await this.prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
    });
    if (!admin) throw new NotFoundException('Admin not found');

    await this.prisma.user.delete({ where: { id } });

    return { message: 'Admin removed successfully' };
  }

  async getDashboard() {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay()); // Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59);

    // ── Brides ──────────────────────────────────────────────────
    const [totalBrides, newBridesThisMonth] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: 'BRIDE' } }),
      this.prisma.user.count({
        where: { role: 'BRIDE', createdAt: { gte: startOfMonth } },
      }),
    ]);

    // ── Appointments this week ───────────────────────────────────
    const weekAppts = await this.prisma.appointment.findMany({
      where: {
        startTime: { gte: startOfWeek, lte: endOfWeek },
        status: { in: ['SCHEDULED', 'RESCHEDULED'] },
      },
      include: {
        bride: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const nextAppt = await this.prisma.appointment.findFirst({
      where: {
        startTime: { gte: startOfToday },
        status: { in: ['SCHEDULED', 'RESCHEDULED'] },
      },
      include: { bride: { select: { id: true, name: true } } },
      orderBy: { startTime: 'asc' },
    });

    // ── Payments ─────────────────────────────────────────────────
    const allPayments = await this.prisma.payment.findMany();
    const paidThisMonth = allPayments
      .filter(
        (p) =>
          p.status === 'PAID' &&
          p.paidDate &&
          p.paidDate >= startOfMonth &&
          p.paidDate <= endOfMonth,
      )
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const outstanding = allPayments
      .filter((p) => p.status !== 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const outstandingBrideIds = new Set(
      allPayments.filter((p) => p.status !== 'PAID').map((p) => p.brideId),
    );

    // ── Recent brides (max 6, sorted by wedding date closest first) ──
    const today = new Date();
    const recentBrides = await this.prisma.user.findMany({
      where: {
        role: 'BRIDE',
        brideProfile: {
          weddingDate: {
            gte: today, // only future or today
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        brideProfile: {
          select: { stage: true, weddingDate: true, phone: true },
        },
        payments: { select: { amount: true, status: true } },
      },
      orderBy: [{ brideProfile: { weddingDate: 'asc' } }],
      take: 6,
    });

    const bridesWithBalance = recentBrides.map((b) => {
      const total = b.payments.reduce((s, p) => s + Number(p.amount), 0);
      const paid = b.payments
        .filter((p) => p.status === 'PAID')
        .reduce((s, p) => s + Number(p.amount), 0);
      return {
        id: b.id,
        name: b.name,
        email: b.email,
        createdAt: b.createdAt,
        brideProfile: b.brideProfile,
        balance: total - paid,
        hasDue: total - paid > 0,
      };
    });

    // ── Recent activity (last 10 events across appointments, payments, fittings) ──
    const [recentApptChanges, recentPaidPayments, recentFittingPhotos] =
      await this.prisma.$transaction([
        this.prisma.appointment.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { bride: { select: { name: true } } },
        }),
        this.prisma.payment.findMany({
          where: { status: 'PAID' },
          orderBy: { paidDate: 'desc' },
          take: 5,
          include: { bride: { select: { name: true } } },
        }),
        this.prisma.fittingPhoto.findMany({
          orderBy: { uploadedAt: 'desc' },
          take: 5,
          include: {
            fitting: {
              include: { bride: { select: { name: true } } },
            },
          },
        }),
      ]);

    type ActivityItem = {
      type: 'appointment' | 'payment' | 'photo';
      label: string;
      brideName: string;
      timestamp: Date;
    };

    const activity: ActivityItem[] = [
      ...recentApptChanges.map((a) => ({
        type: 'appointment' as const,
        label: `Appointment scheduled: ${a.title
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase())}`,
        brideName: a.bride.name,
        timestamp: a.createdAt,
      })),
      ...recentPaidPayments.map((p) => ({
        type: 'payment' as const,
        label: `Payment recorded: $${Number(p.amount).toLocaleString()}`,
        brideName: p.bride.name,
        timestamp: p.paidDate ?? p.createdAt,
      })),
      ...recentFittingPhotos.map((ph) => ({
        type: 'photo' as const,
        label: `Fitting photo uploaded`,
        brideName: ph.fitting.bride.name,
        timestamp: ph.uploadedAt,
      })),
    ]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 3);

    return {
      totalBrides,
      newBridesThisMonth,
      weekApptsCount: weekAppts.length,
      weekAppts: weekAppts.slice(0, 4).map((a) => ({
        id: a.id,
        title: a.title,
        brideName: a.bride.name,
        startTime: a.startTime,
      })),
      nextAppt: nextAppt
        ? {
            id: nextAppt.id,
            title: nextAppt.title,
            brideName: nextAppt.bride.name,
            startTime: nextAppt.startTime,
          }
        : null,
      paidThisMonth,
      outstanding,
      outstandingBridesCount: outstandingBrideIds.size,
      brides: bridesWithBalance,
      recentActivity: activity,
    };
  }

  async resetUserPassword(
    id: string,
    requestingAdminId: string,
    dto: ResetAdminPasswordDto,
  ) {
    if (id === requestingAdminId) {
      throw new BadRequestException(
        'Use /auth/change-password to change your own password',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });

    return {
      message: `${user.role === 'BRIDE' ? 'Bride' : 'Admin'} password reset successfully`,
    };
  }
}
