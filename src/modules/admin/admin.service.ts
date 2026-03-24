import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ResetAdminPasswordDto } from './dto/reset-admin-password.dto';
import { RegisterBrideDto } from '../auth/dto/register-bride.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async registerBride(dto: RegisterBrideDto) {
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
        role: 'BRIDE',
        brideProfile: {
          create: {
            weddingDate: dto.weddingDate ? new Date(dto.weddingDate) : null,
            phone: dto.phone ?? null,
            stylePreferences: dto.stylePreferences ?? null,
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

  async resetAdminPassword(
    id: string,
    requestingAdminId: string,
    dto: ResetAdminPasswordDto,
  ) {
    if (id === requestingAdminId) {
      throw new BadRequestException(
        'Use /auth/change-password to change your own password',
      );
    }

    const admin = await this.prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
    });
    if (!admin) throw new NotFoundException('Admin not found');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });

    return { message: 'Admin password reset successfully' };
  }
}
