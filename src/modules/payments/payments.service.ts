import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus, AppointmentTitle, Role } from '@prisma/client';
import { NotificationService } from '../../common/notifications/notification.service';
import { buildNotificationMessage } from '../../common/utils/notification.util';
import { ConfigService } from '@nestjs/config';
import { CurrencyService } from '../../common/currency/currency.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private config: ConfigService,
    private currencyService: CurrencyService,
  ) {}

  private getPaymentLabel(type: AppointmentTitle | string): string {
    const labels: Record<string, string> = {
      // Shared stages
      CONSULTATION: 'Consultation',
      ALTERATION: 'Alteration',
      GOWN_COMPLETE: 'Gown Complete',
      COLLECTION_READY: 'Collection Ready',
      // Custom dress flow
      MEASUREMENTS: 'Measurements',
      CALICO: 'Calico',
      GOWN_IN_FABRIC: 'Gown in Fabric',
      DETAIL_ON: 'Detail On',
      // RTW flow
      GOWN_TRY_ON: 'Gown Try On',
      // Generic
      CUSTOM: 'Custom',
    };
    return labels[type] || type;
  }

  async create(dto: CreatePaymentDto) {
    const bride = await this.prisma.user.findUnique({
      where: { id: dto.brideId },
      include: { brideProfile: true },
    });

    if (!bride || bride.role !== Role.BRIDE) {
      throw new NotFoundException('Bride not found');
    }

    // Get bride's currency
    const brideCurrency = bride.brideProfile?.currency || 'AUD';

    // Convert to AUD for admin reporting (required - will throw error if fails)
    const exchangeData = await this.currencyService.convertToAUD(
      dto.amount,
      brideCurrency,
    );

    const payment = await this.prisma.payment.create({
      data: {
        brideId: dto.brideId,
        amount: dto.amount,
        currency: brideCurrency,
        paymentType: dto.paymentType,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: dto.markAsPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
        paidDate: dto.markAsPaid ? new Date() : null,
        notes: dto.notes,
        exchangeRateToAUD: exchangeData.exchangeRate,
        amountInAUD: exchangeData.amountInAUD,
        exchangeRateSource: exchangeData.source,
        convertedAt: exchangeData.convertedAt,
      },
      include: { bride: true },
    });

    let notificationStatus = {
      emailSent: false,
      smsSent: false,
      message: 'Payment marked as paid, no notification sent',
    };

    if (!dto.markAsPaid) {
      const portalUrl = `${this.config.get<string>('frontend.url')}/bride/payments`;
      try {
        const result = await this.notificationService.sendPaymentRequest({
          brideName: bride.name,
          brideEmail: bride.email,
          bridePhone: bride.brideProfile?.phone,
          amount: dto.amount,
          currency: brideCurrency,
          label: this.getPaymentLabel(dto.paymentType),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(),
          paymentUrl: portalUrl,
        });

        notificationStatus = {
          emailSent: result.emailSent,
          smsSent: result.smsSent,
          message: buildNotificationMessage(result),
        };
      } catch (err) {
        this.logger.error('Failed to send payment request notification', err);
      }
    }

    return { ...payment, notificationStatus };
  }

  async markAsPaid(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { bride: { include: { brideProfile: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // Get bride's currency and convert to AUD if not already done
    const brideCurrency = payment.bride.brideProfile?.currency || 'AUD';

    // Convert to AUD if not already converted (required - will throw error if fails)
    let exchangeData: {
      amountInAUD: number;
      exchangeRate: number;
      source: string;
      convertedAt: Date;
    } | null = null;

    if (!payment.exchangeRateToAUD || !payment.amountInAUD) {
      exchangeData = await this.currencyService.convertToAUD(
        Number(payment.amount),
        brideCurrency,
      );
    }

    return this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.PAID,
        paidDate: new Date(),
        ...(exchangeData && {
          exchangeRateToAUD: exchangeData.exchangeRate,
          amountInAUD: exchangeData.amountInAUD,
          exchangeRateSource: exchangeData.source,
          convertedAt: exchangeData.convertedAt,
        }),
      },
    });
  }

  async updatePayment(
    id: string,
    data: {
      amount?: number;
      dueDate?: string;
      notes?: string;
      markAsPaid?: boolean;
    },
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { bride: { include: { brideProfile: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException(
        'Cannot edit a payment that has already been paid',
      );
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.dueDate !== undefined && { dueDate: new Date(data.dueDate) }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.markAsPaid && {
          status: PaymentStatus.PAID,
          paidDate: new Date(),
        }),
      },
      include: { bride: { include: { brideProfile: true } } },
    });

    // Send email notification about payment update (only if not marked as paid)
    let notificationStatus = {
      emailSent: false,
      smsSent: false,
      message: 'Payment marked as paid, no notification sent',
    };

    if (!data.markAsPaid) {
      const portalUrl = `${this.config.get<string>('frontend.url')}/bride/payments`;
      try {
        const result = await this.notificationService.sendPaymentRequest({
          brideName: payment.bride.name,
          brideEmail: payment.bride.email,
          bridePhone: payment.bride.brideProfile?.phone,
          amount: data.amount ?? Number(payment.amount),
          currency: payment.bride.brideProfile?.currency || 'AUD',
          label: this.getPaymentLabel(payment.paymentType),
          dueDate: data.dueDate ? new Date(data.dueDate) : payment.dueDate,
          paymentUrl: portalUrl,
        });

        notificationStatus = {
          emailSent: result.emailSent,
          smsSent: result.smsSent,
          message: buildNotificationMessage(result),
        };
      } catch (err) {
        this.logger.error('Failed to send payment update notification', err);
      }
    }

    return { ...updatedPayment, notificationStatus };
  }

  async sendReminder(brideId: string) {
    const bride = await this.prisma.user.findUnique({
      where: { id: brideId },
      include: {
        brideProfile: true,
        payments: {
          where: { status: PaymentStatus.PENDING },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!bride) {
      throw new NotFoundException('Bride not found');
    }

    if (bride.payments.length === 0) {
      throw new BadRequestException('No pending payments to remind for');
    }

    const portalUrl = `${this.config.get<string>('frontend.url')}/bride/payments`;

    // Prepare all unpaid payments data
    const unpaidPayments = bride.payments.map((p) => ({
      amount: Number(p.amount),
      label: this.getPaymentLabel(p.paymentType),
      dueDate: p.dueDate || new Date(),
    }));

    try {
      const result = await this.notificationService.sendPaymentReminder({
        brideName: bride.name,
        brideEmail: bride.email,
        bridePhone: bride.brideProfile?.phone,
        currency: bride.brideProfile?.currency || 'AUD',
        payments: unpaidPayments,
        paymentUrl: portalUrl,
      });

      // Update reminderSentAt for all pending payments
      await this.prisma.payment.updateMany({
        where: {
          brideId,
          status: PaymentStatus.PENDING,
        },
        data: {
          reminderSentAt: new Date(),
        } as any,
      });

      return {
        message: 'Reminder sent successfully',
        notificationStatus: {
          emailSent: result.emailSent,
          smsSent: result.smsSent,
          message: buildNotificationMessage(result),
        },
      };
    } catch (err) {
      this.logger.error('Failed to send payment reminder notification', err);
      throw err;
    }
  }

  async getAdminPayments(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.bride = {
        name: { contains: search, mode: 'insensitive' },
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          bride: {
            select: {
              id: true,
              name: true,
              email: true,
              brideProfile: {
                select: {
                  stylePreferences: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRevenueOverview() {
    const allPayments = await this.prisma.payment.findMany();

    // Use amountInAUD for revenue collected (converted to AUD)
    const revenueCollected = allPayments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amountInAUD), 0);

    // Calculate total outstanding across all brides using totalGownAmount
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
          select: {
            amountInAUD: true,
            status: true,
            dueDate: true,
          },
        },
      },
    });

    let outstanding = 0;
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

      outstanding += brideOutstanding;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Calculate payments due this month (count and amount in AUD)
    const paymentsDueList = allPayments.filter(
      (p) =>
        p.status === PaymentStatus.PENDING &&
        p.dueDate &&
        p.dueDate >= startOfMonth &&
        p.dueDate < startOfNextMonth,
    );
    const paymentsDue = paymentsDueList.length;
    const paymentsDueAmount = paymentsDueList.reduce(
      (sum, p) => sum + Number(p.amountInAUD),
      0,
    );

    // Calculate overdue payments (count and amount in AUD)
    const overdueList = allPayments.filter(
      (p) =>
        p.status === ('OVERDUE' as any) ||
        (p.status === PaymentStatus.PENDING &&
          p.dueDate &&
          new Date(p.dueDate) < today),
    );
    const overdueCount = overdueList.length;
    const overdueAmount = overdueList.reduce(
      (sum, p) => sum + Number(p.amountInAUD),
      0,
    );

    return {
      revenueCollected,
      outstanding,
      paymentsDue,
      paymentsDueAmount,
      overdueCount,
      overdueAmount,
    };
  }

  async getMonthlyRevenue(year?: number) {
    const currentYear = year || new Date().getFullYear();
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PAID,
        paidDate: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31`),
        },
      },
    });

    const monthlyData = Array(12).fill(0);
    payments.forEach((p) => {
      if (p.paidDate) {
        // Use amountInAUD for aggregated monthly revenue in AUD
        monthlyData[p.paidDate.getMonth()] += Number(p.amountInAUD);
      }
    });

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months.map((name, index) => ({
      name,
      amount: monthlyData[index],
    }));
  }

  async getBridesPaymentTracking(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { role: Role.BRIDE };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (!search) {
      where.payments = { ...(where.payments ?? {}), some: {} };
    } else {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status && status !== 'All') {
      if (status === 'overdue') {
        where.payments = {
          some: {
            OR: [
              { status: 'OVERDUE' as any },
              {
                status: PaymentStatus.PENDING,
                dueDate: { lt: today },
              },
            ],
          },
        };
      } else if (status === 'due') {
        where.payments = {
          some: {
            status: 'PENDING',
            OR: [{ dueDate: null }, { dueDate: { gte: today } }],
          },
        };
      } else if (status === 'paid') {
        where.payments = {
          every: { status: 'PAID' },
          some: {},
        };
      }
    }

    const [total, brides] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          brideProfile: true,
          payments: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const items = brides.map((bride) => {
      // Use totalGownAmount if available, otherwise fall back to sum of payments
      const totalAmount = bride.brideProfile?.totalGownAmount
        ? Number(bride.brideProfile.totalGownAmount)
        : bride.payments.reduce((sum, p) => sum + Number(p.amount), 0);

      const paidAmount = bride.payments
        .filter((p) => p.status === PaymentStatus.PAID)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const hasOverdue = bride.payments.some(
        (p) =>
          p.status === ('OVERDUE' as any) ||
          (p.status === PaymentStatus.PENDING &&
            p.dueDate &&
            new Date(p.dueDate) < today),
      );

      const hasDue = bride.payments.some(
        (p) =>
          p.status === 'PENDING' &&
          (!p.dueDate || new Date(p.dueDate) >= today),
      );

      // Determine if fully paid based on totalGownAmount
      let isFullyPaid = false;
      if (bride.brideProfile?.totalGownAmount) {
        // If totalGownAmount exists, check if paid amount equals or exceeds it
        isFullyPaid = paidAmount >= Number(bride.brideProfile.totalGownAmount);
      } else {
        // Fallback: check if all payments are paid
        isFullyPaid =
          bride.payments.length > 0 &&
          bride.payments.every((p) => p.status === 'PAID');
      }

      let currentStatus = 'on-track';
      if (isFullyPaid) currentStatus = 'paid';
      else if (hasOverdue) currentStatus = 'overdue';
      else if (hasDue || paidAmount < totalAmount) currentStatus = 'due';

      return {
        id: bride.id,
        name: bride.name,
        email: bride.email,
        total: totalAmount,
        paid: paidAmount,
        status: currentStatus,
        country: bride.brideProfile?.country || 'AU',
        currency: bride.brideProfile?.currency || 'AUD',
        payments: bride.payments,
      };
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async remove(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException(
        'Cannot delete a payment that has already been paid',
      );
    }
    await this.prisma.payment.delete({ where: { id } });
    return { message: 'Payment deleted' };
  }

  async getBridePayments(brideId: string) {
    return this.prisma.payment.findMany({
      where: { brideId },
      orderBy: { dueDate: 'asc' },
    });
  }
}
