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

  async getAllNames(params?: {
    search?: string;
    limit?: number;
  }): Promise<{ id: string; name: string; email: string }[]> {
    const limit = params?.limit ?? 10;
    const where: any = { role: 'BRIDE' };

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
      take: limit,
    });
  }

  async getJourney(brideId: string) {
    const STAGE_ORDER = [
      'CONSULTATION',
      'FIRST_FITTING',
      'SECOND_FITTING',
      'THIRD_FITTING',
      'FINAL_FITTING',
      'ALTERATION',
      'COLLECTION_READY',
    ] as const;

    const STAGE_LABELS: Record<string, string> = {
      CONSULTATION: 'Consultation',
      FIRST_FITTING: '1st Fitting',
      SECOND_FITTING: '2nd Fitting',
      THIRD_FITTING: '3rd Fitting',
      FINAL_FITTING: 'Final Fitting',
      ALTERATION: 'Alteration',
      COLLECTION_READY: 'Collection Ready',
    };

    const TITLE_LABELS: Record<string, string> = {
      ...STAGE_LABELS,
      CUSTOM: 'Custom',
    };

    const bride = await this.prisma.user.findFirst({
      where: { id: brideId, role: 'BRIDE' },
      select: {
        id: true,
        name: true,
        brideProfile: { select: { stage: true } },
        fittings: {
          include: {
            photos: true,
            appointment: {
              select: {
                id: true,
                title: true,
                description: true,
                location: true,
                startTime: true,
                endTime: true,
                status: true,
                whatToBring: true,
              },
            },
          },
          orderBy: { fittingNumber: 'asc' },
        },
        appointments: {
          where: { status: { in: ['SCHEDULED', 'RESCHEDULED'] } },
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            startTime: true,
            endTime: true,
            status: true,
            whatToBring: true,
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!bride) throw new NotFoundException('Bride not found');

    // ── Progress card: fixed 7 stages ──────────────────────────
    const currentStage = bride.brideProfile?.stage ?? 'CONSULTATION';
    const currentIdx = STAGE_ORDER.indexOf(currentStage as any);
    const progressPct = Math.round(
      ((currentIdx + 1) / STAGE_ORDER.length) * 100,
    );

    const stageProgress = STAGE_ORDER.map((key, i) => ({
      key,
      label: STAGE_LABELS[key],
      status:
        i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming',
    }));

    // ── Timeline: fittings with completed appointments ──────────
    const completedEvents = bride.fittings
      .filter((f) => f.appointment?.status === 'COMPLETED')
      .map((f) => ({
        type: 'completed' as const,
        appointmentId: f.appointment!.id,
        title: TITLE_LABELS[f.appointment!.title] ?? f.appointment!.title,
        description: f.appointment!.description,
        location: f.appointment!.location,
        startTime: f.appointment!.startTime,
        endTime: f.appointment!.endTime,
        whatToBring: f.appointment!.whatToBring,
        fittingId: f.id,
        fittingNumber: f.fittingNumber,
        notes: f.notes,
        photos: f.photos.map((p) => ({
          id: p.id,
          imageUrl: p.imageUrl,
          caption: p.caption,
        })),
      }))
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

    // ── Timeline: upcoming appointments (today or future) ───────
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcomingAppts = bride.appointments
      .filter((a) => new Date(a.startTime) >= now)
      .map((a, i) => ({
        type: i === 0 ? ('in-progress' as const) : ('coming-soon' as const),
        appointmentId: a.id,
        title: TITLE_LABELS[a.title] ?? a.title,
        description: a.description,
        location: a.location,
        startTime: a.startTime,
        endTime: a.endTime,
        whatToBring: a.whatToBring,
        fittingId: null,
        fittingNumber: null,
        notes: null,
        photos: [],
      }));

    return {
      currentStage,
      currentStageIndex: currentIdx,
      progressPct,
      stageProgress,
      events: [...completedEvents, ...upcomingAppts],
    };
  }

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
    if (dto.address !== undefined) profileUpdate.address = dto.address;
    if (dto.partnerName !== undefined)
      profileUpdate.partnerName = dto.partnerName;
    if (dto.venueName !== undefined) profileUpdate.venueName = dto.venueName;
    if (dto.guestCount !== undefined) profileUpdate.guestCount = dto.guestCount;
    if (dto.dietaryNotes !== undefined)
      profileUpdate.dietaryNotes = dto.dietaryNotes;
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

    if (query.stage || query.stylePreferences || query.brideType) {
      const profileWhere: Record<string, unknown> = {};
      if (query.stage) profileWhere.stage = query.stage;
      if (query.brideType) profileWhere.brideType = query.brideType;
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
        select: {
          ...BRIDE_SELECT,
          payments: { select: { amount: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items = data.map(({ payments, ...bride }) => {
      const outstanding = payments
        .filter((p) => p.status !== 'PAID')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      return { ...bride, outstanding };
    });

    return {
      data: items,
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
