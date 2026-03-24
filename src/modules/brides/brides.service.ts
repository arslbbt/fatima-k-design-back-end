import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { BrideStage } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UpdateBrideProfileDto } from './dto/update-bride-profile.dto';
import { UpdateBrideStageDto } from './dto/update-bride-stage.dto';
import { ListBridesQueryDto } from './dto/list-brides-query.dto';

// Reusable select shape — never expose passwordHash
const BRIDE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  brideProfile: true,
} as const;

@Injectable()
export class BridesService {
  constructor(private prisma: PrismaService) {}

  async getMyProfile(userId: string) {
    const bride = await this.prisma.user.findUnique({
      where: { id: userId },
      select: BRIDE_SELECT,
    });
    if (!bride) throw new NotFoundException('Profile not found');
    return bride;
  }

  async updateMyProfile(userId: string, dto: UpdateBrideProfileDto) {
    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: userId } },
      });
      if (conflict) throw new ConflictException('Email already in use');
    }

    const userUpdate: Record<string, unknown> = {};
    if (dto.name !== undefined) userUpdate.name = dto.name;
    if (dto.email !== undefined) userUpdate.email = dto.email;

    const profileUpdate: Record<string, unknown> = {};
    if (dto.weddingDate !== undefined)
      profileUpdate.weddingDate = new Date(dto.weddingDate);
    if (dto.phone !== undefined) profileUpdate.phone = dto.phone;
    if (dto.stylePreferences !== undefined)
      profileUpdate.stylePreferences = dto.stylePreferences;
    // notes: always write if key is present — empty string or null clears it
    if ('notes' in dto) profileUpdate.notes = dto.notes ?? null;

    if (
      Object.keys(userUpdate).length === 0 &&
      Object.keys(profileUpdate).length === 0
    ) {
      throw new BadRequestException('No fields provided to update');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...userUpdate,
        ...(Object.keys(profileUpdate).length > 0 && {
          brideProfile: { update: profileUpdate },
        }),
      },
      select: BRIDE_SELECT,
    });
  }

  // ── Admin-only ──────────────────────────────────────────────

  async findAll(query: ListBridesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { role: 'BRIDE' };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.stage || query.stylePreferences) {
      const profileWhere: Record<string, unknown> = {};
      if (query.stage) profileWhere.stage = query.stage;
      if (query.stylePreferences)
        profileWhere.stylePreferences = {
          contains: query.stylePreferences,
          mode: 'insensitive',
        };
      where.brideProfile = profileWhere;
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: BRIDE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const bride = await this.prisma.user.findFirst({
      where: { id, role: 'BRIDE' },
      select: BRIDE_SELECT,
    });
    if (!bride) throw new NotFoundException('Bride not found');
    return bride;
  }

  async updateStage(id: string, dto: UpdateBrideStageDto) {
    const bride = await this.prisma.user.findFirst({
      where: { id, role: 'BRIDE' },
    });
    if (!bride) throw new NotFoundException('Bride not found');

    return this.prisma.user.update({
      where: { id },
      data: { brideProfile: { update: { stage: dto.stage } } },
      select: BRIDE_SELECT,
    });
  }

  async remove(id: string) {
    const bride = await this.prisma.user.findFirst({
      where: { id, role: 'BRIDE' },
    });
    if (!bride) throw new NotFoundException('Bride not found');

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Bride account removed successfully' };
  }
}
