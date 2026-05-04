import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ResetAdminPasswordDto } from './dto/reset-admin-password.dto';
import { RegisterBrideDto } from '../auth/dto/register-bride.dto';
import * as bcrypt from 'bcrypt';
import { NotificationService } from '../../common/notifications/notification.service';
import { buildNotificationMessage } from '../../common/utils/notification.util';
import { CurrencyService } from '../../common/currency/currency.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private currencyService: CurrencyService,
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

    // Determine country and currency
    const countryCode = dto.country || 'AU'; // Default to Australia
    const currency = this.currencyService.getCurrencyByCountryCode(countryCode);

    // Convert totalGownAmount to AUD if provided
    let totalGownAmountInAUD: number | null = null;
    if (dto.totalGownAmount) {
      try {
        const converted = await this.currencyService.convertToAUD(
          dto.totalGownAmount,
          currency,
        );
        totalGownAmountInAUD = converted.amountInAUD;
      } catch (err) {
        this.logger.warn(
          `Failed to convert totalGownAmount to AUD for new bride`,
        );
        // Continue without conversion - will be null
      }
    }

    // Create bride with profile
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: 'BRIDE',
        brideProfile: {
          create: {
            brideType: dto.brideType ?? 'CUSTOM',
            weddingDate: dto.weddingDate ? new Date(dto.weddingDate) : null,
            phone: dto.phone ?? null,
            partnerName: dto.partnerName ?? null,
            venueName: dto.venueName ?? null,
            notes: dto.notes ?? null,
            totalGownAmount: dto.totalGownAmount ?? null,
            totalGownAmountInAUD: totalGownAmountInAUD,
            country: countryCode,
            currency: currency,
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

    // Create initial payment if provided
    if (dto.initialPaymentAmount && dto.initialPaymentType) {
      try {
        // Convert payment to AUD for admin reporting (required)
        const exchangeData = await this.currencyService.convertToAUD(
          dto.initialPaymentAmount,
          currency,
        );

        await this.prisma.payment.create({
          data: {
            brideId: user.id,
            amount: dto.initialPaymentAmount,
            currency: currency,
            paymentType: dto.initialPaymentType,
            status: 'PAID',
            paidDate: new Date(),
            dueDate: new Date(),
            notes: dto.initialPaymentNotes ?? null,
            exchangeRateToAUD: exchangeData.exchangeRate,
            amountInAUD: exchangeData.amountInAUD,
            exchangeRateSource: exchangeData.source,
            convertedAt: exchangeData.convertedAt,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to convert ${currency} to AUD. Initial payment not created:`,
          error,
        );
        // Bride is created successfully, but initial payment is skipped
      }
    }

    // Send welcome email + SMS with login credentials
    let notificationStatus = {
      emailSent: false,
      smsSent: false,
      message: 'Notification failed',
    };

    try {
      const result = await this.notificationService.sendWelcome({
        brideName: user.name,
        brideEmail: user.email,
        bridePhone: user.brideProfile?.phone,
        temporaryPassword: dto.password,
      });

      notificationStatus = {
        emailSent: result.emailSent,
        smsSent: result.smsSent,
        message: buildNotificationMessage(result),
      };
    } catch (err) {
      this.logger.error('Failed to send welcome notification', err);
      // Don't throw - user is created successfully
    }

    return { ...user, notificationStatus };
  }

  async updateBride(id: string, dto: any) {
    const bride = await this.prisma.user.findFirst({
      where: { id, role: 'BRIDE' },
      include: { brideProfile: true },
    });
    if (!bride) throw new NotFoundException('Bride not found');

    const userData: Record<string, unknown> = {};
    const profileData: Record<string, unknown> = {};

    // User fields
    if (dto.name) userData.name = dto.name;
    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Email already in use');
      userData.email = dto.email;
    }

    // Profile fields
    if (dto.brideType !== undefined) profileData.brideType = dto.brideType;
    if (dto.weddingDate !== undefined)
      profileData.weddingDate = dto.weddingDate
        ? new Date(dto.weddingDate)
        : null;
    if (dto.phone !== undefined) profileData.phone = dto.phone;
    if (dto.partnerName !== undefined)
      profileData.partnerName = dto.partnerName;
    if (dto.venueName !== undefined) profileData.venueName = dto.venueName;
    if (dto.notes !== undefined) profileData.notes = dto.notes;

    // Handle totalGownAmount update with AUD conversion
    if (dto.totalGownAmount !== undefined) {
      profileData.totalGownAmount = dto.totalGownAmount;

      // Convert to AUD if totalGownAmount is provided
      if (dto.totalGownAmount) {
        const currency = dto.country
          ? this.currencyService.getCurrencyByCountryCode(dto.country)
          : bride.brideProfile?.currency || 'AUD';

        this.logger.log(
          `Converting totalGownAmount ${dto.totalGownAmount} ${currency} to AUD for bride ${id}`,
        );

        try {
          const converted = await this.currencyService.convertToAUD(
            Number(dto.totalGownAmount),
            currency,
          );
          profileData.totalGownAmountInAUD = converted.amountInAUD;
          this.logger.log(
            `Converted amount: ${converted.amountInAUD} AUD (rate: ${converted.exchangeRate})`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to convert totalGownAmount to AUD for bride ${id}`,
            err,
          );
          // Set to null if conversion fails
          profileData.totalGownAmountInAUD = null;
        }
      } else {
        // If totalGownAmount is cleared, clear the AUD amount too
        profileData.totalGownAmountInAUD = null;
      }
    }

    if (dto.country !== undefined) {
      profileData.country = dto.country;
      const newCurrency = this.currencyService.getCurrencyByCountryCode(
        dto.country,
      );
      profileData.currency = newCurrency;

      // If country changes and totalGownAmount exists, recalculate AUD amount
      if (bride.brideProfile?.totalGownAmount) {
        try {
          const converted = await this.currencyService.convertToAUD(
            Number(bride.brideProfile.totalGownAmount),
            newCurrency,
          );
          profileData.totalGownAmountInAUD = converted.amountInAUD;
        } catch (err) {
          this.logger.warn(
            `Failed to convert totalGownAmount to AUD after country change for bride ${id}`,
          );
          profileData.totalGownAmountInAUD = null;
        }
      }
    }

    // Update user and profile
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...userData,
        ...(Object.keys(profileData).length > 0 && {
          brideProfile: {
            update: profileData,
          },
        }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true,
        brideProfile: true,
      },
    });

    return updated;
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
      .reduce((sum, p) => sum + Number(p.amountInAUD), 0);

    // Calculate total outstanding across all brides
    const allBridesWithPayments = await this.prisma.user.findMany({
      where: { role: 'BRIDE' },
      select: {
        id: true,
        brideProfile: {
          select: {
            totalGownAmount: true,
            totalGownAmountInAUD: true,
            currency: true,
          },
        },
        payments: {
          select: { amount: true, amountInAUD: true, status: true },
        },
      },
    });

    let outstanding = 0;
    const outstandingBrideIds = new Set<string>();

    for (const bride of allBridesWithPayments) {
      let brideOutstanding = 0;

      if (bride.brideProfile?.totalGownAmount) {
        // If total gown amount is set, calculate: totalGownAmount - totalPaid
        const totalPaid = bride.payments
          .filter((p) => p.status === 'PAID')
          .reduce((sum, p) => sum + Number(p.amountInAUD), 0);

        // Use pre-converted totalGownAmountInAUD if available
        const totalGownAmountInAUD = bride.brideProfile.totalGownAmountInAUD
          ? Number(bride.brideProfile.totalGownAmountInAUD)
          : Number(bride.brideProfile.totalGownAmount); // Fallback for old data

        brideOutstanding = totalGownAmountInAUD - totalPaid;
        brideOutstanding = Math.max(0, brideOutstanding);
      } else {
        // Fallback: sum of unpaid payments (old behavior)
        brideOutstanding = bride.payments
          .filter((p) => p.status !== 'PAID')
          .reduce((sum, p) => sum + Number(p.amountInAUD), 0);
      }

      if (brideOutstanding > 0) {
        outstanding += brideOutstanding;
        outstandingBrideIds.add(bride.id);
      }
    }

    // ── Recent brides (max 6 custom + 6 ready-to-wear, sorted by wedding date closest first) ──
    const today = new Date();

    // Fetch custom brides
    const customBrides = await this.prisma.user.findMany({
      where: {
        role: 'BRIDE',
        brideProfile: {
          weddingDate: {
            gte: today, // only future or today
          },
          brideType: 'CUSTOM',
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        brideProfile: {
          select: {
            stage: true,
            weddingDate: true,
            phone: true,
            brideType: true,
            totalGownAmount: true,
            currency: true,
            country: true,
          },
        },
        payments: {
          select: { amount: true, amountInAUD: true, status: true },
        },
      },
      orderBy: [{ brideProfile: { weddingDate: 'asc' } }],
      take: 6,
    });

    // Fetch ready-to-wear brides
    const readyToWearBrides = await this.prisma.user.findMany({
      where: {
        role: 'BRIDE',
        brideProfile: {
          weddingDate: {
            gte: today, // only future or today
          },
          brideType: 'READY_TO_WEAR',
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        brideProfile: {
          select: {
            stage: true,
            weddingDate: true,
            phone: true,
            brideType: true,
            totalGownAmount: true,
            currency: true,
            country: true,
          },
        },
        payments: {
          select: { amount: true, amountInAUD: true, status: true },
        },
      },
      orderBy: [{ brideProfile: { weddingDate: 'asc' } }],
      take: 6,
    });

    // Combine and sort all brides by wedding date
    const allRecentBrides = [...customBrides, ...readyToWearBrides].sort(
      (a, b) => {
        const dateA = a.brideProfile?.weddingDate
          ? new Date(a.brideProfile.weddingDate).getTime()
          : Infinity;
        const dateB = b.brideProfile?.weddingDate
          ? new Date(b.brideProfile.weddingDate).getTime()
          : Infinity;
        return dateA - dateB;
      },
    );

    const bridesWithBalance = allRecentBrides.map((b) => {
      let balance = 0;

      if (b.brideProfile?.totalGownAmount) {
        // If total gown amount is set, calculate: totalGownAmount - totalPaid
        const totalPaid = b.payments
          .filter((p) => p.status === 'PAID')
          .reduce((s, p) => s + Number(p.amount), 0);
        balance = Number(b.brideProfile.totalGownAmount) - totalPaid;
        // Ensure balance is not negative
        balance = Math.max(0, balance);
      } else {
        // Fallback: sum of unpaid payments (old behavior)
        balance = b.payments
          .filter((p) => p.status !== 'PAID')
          .reduce((s, p) => s + Number(p.amount), 0);
      }

      return {
        id: b.id,
        name: b.name,
        email: b.email,
        createdAt: b.createdAt,
        brideProfile: b.brideProfile,
        balance,
        currency: b.brideProfile?.currency || 'AUD',
        country: b.brideProfile?.country || 'AU',
        hasDue: balance > 0,
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
          include: {
            bride: {
              select: {
                name: true,
                brideProfile: { select: { currency: true } },
              },
            },
          },
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
        label: `Payment recorded: ${Number(p.amount).toLocaleString()} ${p.bride.brideProfile?.currency || 'AUD'}`,
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
