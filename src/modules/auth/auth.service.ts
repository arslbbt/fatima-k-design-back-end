import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { RegisterBrideDto } from './dto/register-bride.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { NotificationService } from '../../common/notifications/notification.service';
import { buildNotificationMessage } from '../../common/utils/notification.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private notificationService: NotificationService,
  ) {}

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

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        brideProfile: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!match)
      throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }
}
