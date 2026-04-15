import {
  Injectable,
  NotFoundException,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus, AppointmentTitle, Role } from '@prisma/client';
import type { IMailService } from '../../common/mail/mail.interface';
import { MAIL_SERVICE } from '../../common/mail/mail.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(MAIL_SERVICE) private mailService: IMailService,
    private config: ConfigService,
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

    const payment = await this.prisma.payment.create({
      data: {
        brideId: dto.brideId,
        amount: dto.amount,
        paymentType: dto.paymentType,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: dto.markAsPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
        paidDate: dto.markAsPaid ? new Date() : null,
        notes: dto.notes,
      },
      include: { bride: true },
    });

    if (!dto.markAsPaid) {
      const portalUrl = `${this.config.get<string>('frontend.url')}/bride/payments`;
      try {
        await this.mailService.sendPaymentRequest({
          brideName: bride.name,
          brideEmail: bride.email,
          amount: dto.amount,
          label: this.getPaymentLabel(dto.paymentType),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(),
          paymentUrl: portalUrl,
        });
      } catch (err) {
        this.logger.error('Failed to send payment request email', err);
      }
    }

    return payment;
  }

  async markAsPaid(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.PAID, paidDate: new Date() },
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
      include: { bride: true },
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
      include: { bride: true },
    });

    // Send email notification about payment update (only if not marked as paid)
    if (!data.markAsPaid) {
      const portalUrl = `${this.config.get<string>('frontend.url')}/bride/payments`;
      try {
        await this.mailService.sendPaymentRequest({
          brideName: payment.bride.name,
          brideEmail: payment.bride.email,
          amount: data.amount ?? Number(payment.amount),
          label: this.getPaymentLabel(payment.paymentType),
          dueDate: data.dueDate ? new Date(data.dueDate) : payment.dueDate,
          paymentUrl: portalUrl,
        });
      } catch (err) {
        this.logger.error('Failed to send payment update email', err);
      }
    }

    return updatedPayment;
  }

  async sendReminder(brideId: string) {
    const bride = await this.prisma.user.findUnique({
      where: { id: brideId },
      include: {
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
      await this.mailService.sendPaymentReminder({
        brideName: bride.name,
        brideEmail: bride.email,
        payments: unpaidPayments,
        paymentUrl: portalUrl,
      });
    } catch (err) {
      this.logger.error('Failed to send payment reminder email', err);
      throw err;
    }

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

    return { message: 'Reminder sent successfully' };
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

    const revenueCollected = allPayments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const outstanding = allPayments
      .filter((p) => p.status !== PaymentStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const paymentsDue = allPayments.filter(
      (p) =>
        p.status === PaymentStatus.PENDING &&
        p.dueDate &&
        p.dueDate >= startOfMonth &&
        p.dueDate < startOfNextMonth,
    ).length;
    const overdueCount = allPayments.filter(
      (p) =>
        p.status === ('OVERDUE' as any) ||
        (p.status === PaymentStatus.PENDING &&
          p.dueDate &&
          new Date(p.dueDate) < today),
    ).length;

    return {
      revenueCollected,
      outstanding,
      paymentsDue,
      overdueCount,
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
        monthlyData[p.paidDate.getMonth()] += Number(p.amount);
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
      const totalAmount = bride.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );

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

      const isFullyPaid =
        bride.payments.length > 0 &&
        bride.payments.every((p) => p.status === 'PAID');

      let currentStatus = 'on-track';
      if (isFullyPaid) currentStatus = 'paid';
      else if (hasOverdue) currentStatus = 'overdue';
      else if (hasDue) currentStatus = 'due';

      return {
        id: bride.id,
        name: bride.name,
        email: bride.email,
        total: totalAmount,
        paid: paidAmount,
        status: currentStatus,
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
