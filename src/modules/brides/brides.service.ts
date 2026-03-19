import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateBrideProfileDto } from './dto/update-bride-profile.dto';

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
    // Check email uniqueness if being changed
    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: userId } },
      });
      if (conflict) throw new ConflictException('Email already in use');
    }

    const userUpdate: Record<string, unknown> = {};
    if (dto.name) userUpdate.name = dto.name;
    if (dto.email) userUpdate.email = dto.email;

    const profileUpdate: Record<string, unknown> = {};
    if (dto.weddingDate) profileUpdate.weddingDate = new Date(dto.weddingDate);
    if (dto.phone) profileUpdate.phone = dto.phone;
    if (dto.stylePreferences)
      profileUpdate.stylePreferences = dto.stylePreferences;

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

  async findAll() {
    return this.prisma.user.findMany({
      where: { role: 'BRIDE' },
      select: BRIDE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const bride = await this.prisma.user.findFirst({
      where: { id, role: 'BRIDE' },
      select: BRIDE_SELECT,
    });
    if (!bride) throw new NotFoundException('Bride not found');
    return bride;
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
